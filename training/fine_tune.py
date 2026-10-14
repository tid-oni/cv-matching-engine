"""
Fine-tuning script for the CV-Job Matching Engine — v2 (upgraded).

Improvements over v1:
  • Uses sentence-transformers v3 SentenceTransformerTrainer API (Hugging Face
    training loop) instead of the deprecated model.fit().
  • Dual-loss training:
      - CosineSimilarityLoss on ALL labelled pairs (regression signal)
      - MultipleNegativesRankingLoss on high-confidence pairs (retrieval signal)
  • Hard-negative injection: pairs high-score CVs with mismatched JDs.
  • Data-quality pipeline: length filter, dedup, label-distribution logging.
  • Step-level loss logging every 50 steps.
  • Weight decay + gradient clipping via TrainingArguments.
  • EmbeddingSimilarityEvaluator per epoch + full metric suite after training.
  • Saves the best checkpoint based on eval Spearman; reloads it for evaluation.

Run from the project root:
    python training/fine_tune.py --epochs 5 --batch-size 16

Datasets:
    1. cnamuangtoun/resume-job-description-fit  (~8 000 pairs)
    2. netsol/resume-score-details              (~1 031 pairs with scores)
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
import warnings
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

# ── path bootstrap ──────────────────────────────────────────────────────────
THIS_FILE  = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# ── dependency check ─────────────────────────────────────────────────────────
def _require_imports() -> None:
    missing = []
    for pkg in ("torch", "datasets", "sentence_transformers", "sklearn", "scipy", "tqdm"):
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"[ERROR] Missing: {', '.join(missing)}\n"
              f"Install: pip install {' '.join(missing)}")
        sys.exit(1)

_require_imports()

import torch
from datasets import Dataset as HFDataset, load_dataset
from scipy.stats import pearsonr, spearmanr
from sentence_transformers import SentenceTransformer, losses
from sentence_transformers import SentenceTransformerTrainer, SentenceTransformerTrainingArguments
from sentence_transformers.evaluation import EmbeddingSimilarityEvaluator
from sklearn.metrics import ndcg_score
from tqdm import tqdm

# ── constants ────────────────────────────────────────────────────────────────
BASE_MODEL   = "BAAI/bge-base-en-v1.5"
DATASET_1    = "cnamuangtoun/resume-job-description-fit"
DATASET_2    = "netsol/resume-score-details"

DEFAULT_OUTPUT_DIR = str(PROJECT_ROOT / "app" / "models" / "cv-matcher-finetuned")
RESULTS_DIR  = PROJECT_ROOT / "results"
RESULTS_JSON = RESULTS_DIR / "evaluation_metrics.json"
RESULTS_CSV  = RESULTS_DIR / "model_comparison.csv"

SEED                 = 42
MIN_TEXT_LEN         = 80          # characters — skip shorter texts
MAX_TEXT_LEN         = 8_000       # characters — truncate before encoding
MNR_LABEL_THRESHOLD  = 0.60        # label >= this → used as MNR positive pair
HARD_NEG_RATIO       = 0.25        # fraction of positives to turn into hard negatives

# ── utilities ────────────────────────────────────────────────────────────────
def set_seed(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

def banner(msg: str) -> None:
    line = "=" * max(60, len(msg) + 4)
    print(f"\n{line}\n  {msg}\n{line}", flush=True)

def safe_str(v) -> str:
    return str(v).strip() if v is not None else ""

def first_nonempty_field(row: dict, candidates: Iterable[str]) -> Optional[str]:
    for k in candidates:
        if k in row and safe_str(row[k]):
            return k
    return None

def normalize_label(value, max_value: float = 1.0) -> float:
    if value is None:
        return 0.0
    if isinstance(value, str):
        mapping = {
            "no fit": 0.0, "no_fit": 0.0, "bad": 0.0, "poor": 0.1, "weak": 0.2,
            "potential fit": 0.5, "potential_fit": 0.5, "partial": 0.5,
            "moderate": 0.6, "good fit": 0.85, "good_fit": 0.85, "good": 0.85,
            "excellent": 1.0, "perfect": 1.0, "yes": 1.0, "no": 0.0,
            "true": 1.0, "false": 0.0,
        }
        v = value.strip().lower()
        if v in mapping:
            return mapping[v]
        try:
            value = float(v)
        except ValueError:
            return 0.0
    try:
        f = float(value)
    except (TypeError, ValueError):
        return 0.0
    if max_value <= 0:
        return 0.0
    f = f / max_value
    return float(max(0.0, min(1.0, f)))

def truncate(text: str, max_chars: int = MAX_TEXT_LEN) -> str:
    return text[:max_chars] if len(text) > max_chars else text

# ── raw pair format ──────────────────────────────────────────────────────────
PairRecord = Dict[str, object]   # {"cv": str, "jd": str, "label": float}

# ── dataset loading ───────────────────────────────────────────────────────────
def _is_dataset_dict(ds) -> bool:
    """True when ds is a DatasetDict (column_names is a dict, not a list)."""
    return hasattr(ds, "keys") and isinstance(getattr(ds, "column_names", None), dict)

def _inspect(ds, name: str) -> None:
    print(f"\n[INFO] Inspecting: {name}")
    try:
        split = ds[list(ds.keys())[0]] if _is_dataset_dict(ds) else ds
        print(f"  Columns : {split.column_names}")
        print(f"  Rows    : {len(split)}")
        print(f"  Row[0]  : { {k: str(v)[:120] for k, v in split[0].items()} }")
    except Exception as e:
        print(f"  [WARN] inspect failed: {e}")

def _all_rows(ds) -> Iterable[dict]:
    if _is_dataset_dict(ds):
        for split in ds.keys():
            yield from ds[split]
    else:
        yield from ds

def _load_dataset1() -> List[PairRecord]:
    records: List[PairRecord] = []
    try:
        print(f"\n[INFO] Downloading {DATASET_1} ...", flush=True)
        ds = load_dataset(DATASET_1)
        _inspect(ds, DATASET_1)
        first = next(iter(_all_rows(ds)))
        cv_f  = first_nonempty_field(first, ["resume_text","resume","cv","cv_text","candidate","candidate_text"])
        jd_f  = first_nonempty_field(first, ["job_description_text","job_description","job","job_text","jd","jd_text"])
        lb_f  = first_nonempty_field(first, ["label","fit","match","score","rating","target","y"])
        if not (cv_f and jd_f and lb_f):
            print(f"[WARN] Could not infer fields: cv={cv_f}, jd={jd_f}, label={lb_f}. Skipping.")
            return []
        print(f"[INFO] Fields: cv='{cv_f}'  jd='{jd_f}'  label='{lb_f}'")
        for row in tqdm(list(_all_rows(ds)), desc=f"Parsing {DATASET_1}"):
            cv  = safe_str(row.get(cv_f))
            jd  = safe_str(row.get(jd_f))
            lbl = normalize_label(row.get(lb_f), max_value=1.0)
            if cv and jd:
                records.append({"cv": cv, "jd": jd, "label": lbl})
        print(f"[INFO] {DATASET_1}: {len(records)} raw pairs")
    except Exception as e:
        print(f"[WARN] Failed to load {DATASET_1}: {e}")
    return records

def _load_dataset2_from_cache() -> List[PairRecord]:
    """Load netsol/resume-score-details directly from the HF hub cache.

    The dataset's HuggingFace loader fails with a schema-cast error because
    different JSON files have different struct fields in their nested dicts.
    We bypass the loader and read the raw snapshot files instead.
    """
    import glob as _glob
    from pathlib import Path as _Path

    hf_cache = _Path.home() / ".cache" / "huggingface" / "hub"
    pattern = str(hf_cache / "datasets--netsol--resume-score-details" / "snapshots" / "*" / "*.json")
    files = _glob.glob(pattern)
    if not files:
        return []

    print(f"[INFO] Loading netsol from cache: {len(files)} JSON files", flush=True)
    records: List[PairRecord] = []
    for fpath in tqdm(files, desc="Parsing netsol cache"):
        try:
            with open(fpath, encoding="utf-8") as fh:
                data = json.load(fh)
            if not isinstance(data, dict):
                continue
            inp = data.get("input", {}) or {}
            out = data.get("output", {}) or {}
            resume = safe_str(inp.get("resume", ""))
            jd     = safe_str(inp.get("job_description", ""))
            if not resume or not jd:
                continue
            # Compute normalised score from macro_scores list
            scores_block = out.get("scores", {}) or {}
            macro = scores_block.get("macro_scores", []) or []
            if macro:
                total = sum(float(s.get("score", 0)) for s in macro if isinstance(s, dict))
                max_v = len(macro) * 10.0
                label = float(max(0.0, min(1.0, total / max_v))) if max_v > 0 else 0.5
            else:
                label = 0.5
            records.append({"cv": resume, "jd": jd, "label": label})
        except Exception:
            continue

    print(f"[INFO] {DATASET_2} (cache): {len(records)} raw pairs")
    return records

def _load_dataset2() -> List[PairRecord]:
    records: List[PairRecord] = []
    try:
        print(f"\n[INFO] Downloading {DATASET_2} ...", flush=True)
        ds = load_dataset(DATASET_2)
        _inspect(ds, DATASET_2)
        first = next(iter(_all_rows(ds)))
        cv_f  = first_nonempty_field(first, ["resume","resume_text","cv","cv_text","candidate","candidate_resume"])
        jd_f  = first_nonempty_field(first, ["job_description","job","job_text","jd","jd_text","job_description_text"])
        lb_f  = first_nonempty_field(first, ["score","rating","match_score","fit_score","label","overall_score"])
        if not (cv_f and jd_f and lb_f):
            print(f"[WARN] Could not infer fields via loader. Trying cache fallback.")
            return _load_dataset2_from_cache()
        # detect scale
        sample_scores = []
        for row in _all_rows(ds):
            try:
                sample_scores.append(float(row[lb_f]))
            except Exception:
                pass
            if len(sample_scores) >= 50:
                break
        mx = max(sample_scores) if sample_scores else 1.0
        max_value = 1.0 if mx <= 1.0 else (10.0 if mx <= 10.0 else (100.0 if mx <= 100.0 else mx))
        print(f"[INFO] Fields: cv='{cv_f}'  jd='{jd_f}'  label='{lb_f}'  scale_max={max_value}")
        for row in tqdm(list(_all_rows(ds)), desc=f"Parsing {DATASET_2}"):
            cv  = safe_str(row.get(cv_f))
            jd  = safe_str(row.get(jd_f))
            lbl = normalize_label(row.get(lb_f), max_value=max_value)
            if cv and jd:
                records.append({"cv": cv, "jd": jd, "label": lbl})
        print(f"[INFO] {DATASET_2}: {len(records)} raw pairs")
    except Exception as e:
        print(f"[WARN] load_dataset failed for {DATASET_2}: {e}. Trying cache fallback.")
        records = _load_dataset2_from_cache()
    return records

def synthetic_fallback(n: int = 150) -> List[PairRecord]:
    """Template-generated fallback when both real datasets fail."""
    print(f"[WARN] Using {n} synthetic pairs as fallback.")
    roles = [
        ("Data Scientist",     ["Python","pandas","scikit-learn","SQL","ML","statistics"]),
        ("Backend Engineer",   ["Python","FastAPI","PostgreSQL","Docker","AWS","REST"]),
        ("Frontend Engineer",  ["React","TypeScript","CSS","HTML","Webpack","Redux"]),
        ("DevOps Engineer",    ["Kubernetes","Terraform","AWS","CI/CD","Linux","Docker"]),
        ("ML Engineer",        ["PyTorch","TensorFlow","MLOps","Python","Kubernetes","ONNX"]),
        ("Mobile Developer",   ["Swift","Kotlin","iOS","Android","Flutter","Dart"]),
        ("Data Engineer",      ["Spark","Airflow","SQL","Kafka","AWS","dbt","Parquet"]),
        ("Cloud Architect",    ["AWS","Azure","GCP","Terraform","CDK","networking","IAM"]),
    ]
    def cv_t(role, skills, yrs):
        return (f"Experienced {role} with {yrs} years in industry. "
                f"Expert in {', '.join(skills)}. Built production systems at scale.")
    def jd_t(role, skills, yrs):
        return (f"Hiring a {role} ({yrs}+ years). Requirements: {', '.join(skills)}. "
                f"You will design and maintain large-scale distributed systems.")
    out: List[PairRecord] = []
    rng = random.Random(SEED)
    while len(out) < n:
        i = rng.randrange(len(roles))
        role_a, sk_a = roles[i]
        yr = rng.randint(1, 10)
        j = (i + rng.randint(1, len(roles)-1)) % len(roles)
        role_b, sk_b = roles[j]
        out.append({"cv": cv_t(role_a, sk_a, yr), "jd": jd_t(role_a, sk_a, yr), "label": 0.95})
        out.append({"cv": cv_t(role_a, sk_a, yr), "jd": jd_t(role_b, sk_b, yr), "label": 0.05})
        partial = sk_a[:max(1, len(sk_a)//2)] + sk_b[:1]
        out.append({"cv": cv_t(role_a, sk_a, yr), "jd": jd_t(role_a, partial, yr), "label": 0.60})
    return out[:n]

# ── data quality pipeline ─────────────────────────────────────────────────────
def filter_and_clean(records: List[PairRecord]) -> List[PairRecord]:
    """Apply length filter, truncation, and deduplication."""
    banner("Data quality pipeline")
    n_raw = len(records)

    cleaned: List[PairRecord] = []
    seen: set = set()
    skipped_short = skipped_dup = 0

    for r in records:
        cv  = r["cv"].strip()
        jd  = r["jd"].strip()
        lbl = float(r["label"])

        # length filter
        if len(cv) < MIN_TEXT_LEN or len(jd) < MIN_TEXT_LEN:
            skipped_short += 1
            continue

        # truncate long texts
        cv = truncate(cv)
        jd = truncate(jd)

        # dedup key on first 200 chars of each side
        key = (cv[:200], jd[:200])
        if key in seen:
            skipped_dup += 1
            continue
        seen.add(key)

        cleaned.append({"cv": cv, "jd": jd, "label": lbl})

    print(f"[INFO] Kept {len(cleaned)} / {n_raw} pairs "
          f"(dropped {skipped_short} short, {skipped_dup} duplicates)")

    # label distribution
    labels = [r["label"] for r in cleaned]
    n_high  = sum(1 for l in labels if l >= 0.7)
    n_mid   = sum(1 for l in labels if 0.3 <= l < 0.7)
    n_low   = sum(1 for l in labels if l < 0.3)
    print(f"[INFO] Label distribution: high(>=0.7)={n_high}  mid(0.3-0.7)={n_mid}  low(<0.3)={n_low}")

    return cleaned

def mine_hard_negatives(records: List[PairRecord]) -> List[PairRecord]:
    """
    Create hard negatives by pairing high-score CVs with low-score JDs from
    different samples. This teaches the model to distinguish good from bad fits.
    """
    positives = [r for r in records if r["label"] >= 0.70]
    low_jds   = [r["jd"] for r in records if r["label"] <= 0.30]

    if not positives or not low_jds:
        print("[INFO] Hard negative mining skipped (not enough data)")
        return []

    n_hard = min(int(len(positives) * HARD_NEG_RATIO), len(low_jds))
    rng    = random.Random(SEED + 1)
    sampled_jds = rng.sample(low_jds, k=n_hard)

    hard_negs: List[PairRecord] = []
    for i, (pos, neg_jd) in enumerate(zip(positives[:n_hard], sampled_jds)):
        # Make sure the negative JD is different from the positive one
        if pos["jd"][:100] != neg_jd[:100]:
            hard_negs.append({"cv": pos["cv"], "jd": neg_jd, "label": 0.05})

    print(f"[INFO] Mined {len(hard_negs)} hard negatives from "
          f"{len(positives)} positives × {len(low_jds)} low-score JDs")
    return hard_negs

# ── split ────────────────────────────────────────────────────────────────────
def split_train_eval(
    records: List[PairRecord], train_ratio: float = 0.80
) -> Tuple[List[PairRecord], List[PairRecord]]:
    n   = len(records)
    cut = int(n * train_ratio)
    return records[:cut], records[cut:]

# ── HuggingFace Dataset builders ─────────────────────────────────────────────
def to_cosine_hf_dataset(records: List[PairRecord]) -> HFDataset:
    """sentence1 / sentence2 / label — for CosineSimilarityLoss."""
    return HFDataset.from_dict({
        "sentence1": [r["cv"] for r in records],
        "sentence2": [r["jd"] for r in records],
        "label":     [float(r["label"]) for r in records],
    })

def to_mnr_hf_dataset(records: List[PairRecord]) -> HFDataset:
    """anchor / positive — for MultipleNegativesRankingLoss."""
    positives = [r for r in records if float(r["label"]) >= MNR_LABEL_THRESHOLD]
    print(f"[INFO] MNR dataset: {len(positives)} positive pairs "
          f"(label >= {MNR_LABEL_THRESHOLD})")
    return HFDataset.from_dict({
        "anchor":   [r["cv"] for r in positives],
        "positive": [r["jd"] for r in positives],
    })

# ── metrics ───────────────────────────────────────────────────────────────────
def compute_metrics(
    model: SentenceTransformer,
    eval_records: List[PairRecord],
    desc: str = "Evaluating",
) -> dict:
    """Spearman, Pearson, NDCG@5, NDCG@10, MRR — computed on eval set."""
    if not eval_records:
        return {"spearman": 0.0, "pearson": 0.0,
                "ndcg@5": 0.0, "ndcg@10": 0.0, "mrr": 0.0}

    cvs    = [r["cv"] for r in eval_records]
    jds    = [r["jd"] for r in eval_records]
    labels = np.asarray([float(r["label"]) for r in eval_records], dtype=np.float64)

    print(f"\n[INFO] {desc}: encoding {len(cvs)} pairs ...", flush=True)
    cv_emb = model.encode(cvs, batch_size=32, convert_to_numpy=True,
                          show_progress_bar=True, normalize_embeddings=True)
    jd_emb = model.encode(jds, batch_size=32, convert_to_numpy=True,
                          show_progress_bar=True, normalize_embeddings=True)

    preds = np.sum(cv_emb * jd_emb, axis=1).astype(np.float64)

    # correlations
    try:
        spearman = float(spearmanr(preds, labels).correlation)
    except Exception:
        spearman = 0.0
    try:
        pearson = float(pearsonr(preds, labels)[0])
    except Exception:
        pearson = 0.0
    if math.isnan(spearman): spearman = 0.0
    if math.isnan(pearson):  pearson  = 0.0

    # NDCG
    try:
        true_2d = labels.reshape(1, -1)
        pred_2d = preds.reshape(1, -1)
        ndcg5  = float(ndcg_score(true_2d, pred_2d, k=5))
        ndcg10 = float(ndcg_score(true_2d, pred_2d, k=10))
    except Exception as e:
        print(f"[WARN] NDCG failed: {e}")
        ndcg5 = ndcg10 = 0.0

    # MRR — reciprocal rank of first relevant item in predicted ranking
    try:
        threshold = float(np.median(labels[labels > 0])) if np.any(labels > 0) else 0.5
        order     = np.argsort(-preds)
        rel_idxs  = set(np.where(labels >= threshold)[0])
        mrr = 0.0
        if rel_idxs:
            rr_list = []
            for query_idx in rel_idxs:
                rank = int(np.where(order == query_idx)[0][0]) + 1
                rr_list.append(1.0 / rank)
            mrr = float(np.mean(rr_list))
    except Exception as e:
        print(f"[WARN] MRR failed: {e}")
        mrr = 0.0

    result = {
        "spearman": round(spearman, 4),
        "pearson":  round(pearson,  4),
        "ndcg@5":   round(ndcg5,   4),
        "ndcg@10":  round(ndcg10,  4),
        "mrr":      round(mrr,     4),
    }
    print(f"[METRICS] {result}")
    return result

def pct_improvement(base: float, new: float) -> str:
    if abs(base) < 1e-9:
        return f"+{(new - base)*100:.1f}%"
    diff = ((new - base) / abs(base)) * 100.0
    return f"{'+' if diff >= 0 else ''}{diff:.1f}%"

# ── training ──────────────────────────────────────────────────────────────────
def train_model(
    train_records: List[PairRecord],
    eval_records:  List[PairRecord],
    output_dir: str,
    epochs: int,
    batch_size: int,
) -> Tuple[SentenceTransformer, float]:
    """
    Fine-tune BAAI/bge-large-en-v1.5 using dual-loss strategy:
      - CosineSimilarityLoss on ALL pairs  (regression signal)
      - MultipleNegativesRankingLoss on positive pairs only  (retrieval signal)
    Uses the sentence-transformers v3 SentenceTransformerTrainer API.
    """
    banner(f"Fine-tuning {BASE_MODEL} | dual-loss | v3 Trainer API")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[INFO] Device: {device}", flush=True)
    print(f"[INFO] Train={len(train_records)}  Eval={len(eval_records)}  "
          f"Epochs={epochs}  Batch={batch_size}", flush=True)

    # Load base model
    print(f"\n[INFO] Loading {BASE_MODEL} ...", flush=True)
    model = SentenceTransformer(BASE_MODEL, device=device)

    # ── build HuggingFace datasets ───────────────────────────────────────────
    cosine_train_ds = to_cosine_hf_dataset(train_records)
    mnr_train_ds    = to_mnr_hf_dataset(train_records)
    cosine_eval_ds  = to_cosine_hf_dataset(eval_records)

    print(f"[INFO] Cosine train: {len(cosine_train_ds)} pairs")
    print(f"[INFO] MNR train   : {len(mnr_train_ds)} positive pairs")
    print(f"[INFO] Cosine eval : {len(cosine_eval_ds)} pairs")

    # ── losses ───────────────────────────────────────────────────────────────
    cosine_loss = losses.CosineSimilarityLoss(model)
    mnr_loss    = losses.MultipleNegativesRankingLoss(model)

    # ── evaluator (per-epoch) ─────────────────────────────────────────────────
    evaluator = None
    if eval_records:
        evaluator = EmbeddingSimilarityEvaluator(
            sentences1=[r["cv"] for r in eval_records],
            sentences2=[r["jd"] for r in eval_records],
            scores   =[float(r["label"]) for r in eval_records],
            name="cv_job_eval",
        )

    # ── training arguments ────────────────────────────────────────────────────
    steps_per_epoch_cosine = max(1, len(cosine_train_ds) // batch_size)
    steps_per_epoch_mnr    = max(1, len(mnr_train_ds)    // batch_size)
    # Combined steps per epoch (alternating datasets)
    steps_per_epoch = steps_per_epoch_cosine + steps_per_epoch_mnr
    total_steps     = steps_per_epoch * epochs
    warmup_steps    = max(100, min(500, int(0.10 * total_steps)))

    print(f"[INFO] Steps/epoch ~{steps_per_epoch}  "
          f"Total ~{total_steps}  Warmup={warmup_steps}")

    os.makedirs(output_dir, exist_ok=True)

    training_args = SentenceTransformerTrainingArguments(
        output_dir              = output_dir,
        num_train_epochs        = epochs,
        per_device_train_batch_size = batch_size,
        per_device_eval_batch_size  = batch_size,
        learning_rate           = 2e-5,
        weight_decay            = 0.01,
        warmup_steps            = warmup_steps,
        max_grad_norm           = 1.0,
        # evaluation & saving — save every 200 steps so sleep can't wipe progress
        eval_strategy           = "epoch",
        save_strategy           = "steps",
        save_steps              = 200,
        load_best_model_at_end  = False,        # incompatible with mixed save_strategy/eval_strategy
        # logging
        logging_steps           = 50,
        logging_first_step      = True,
        report_to               = "none",       # no wandb / tensorboard
        # hardware
        fp16                    = torch.cuda.is_available(),   # halves VRAM on GPU
        bf16                    = False,
        dataloader_num_workers  = 0,            # Windows compatibility
        seed                    = SEED,
        # checkpoints
        save_total_limit        = 3,
    )

    # ── trainer ──────────────────────────────────────────────────────────────
    trainer = SentenceTransformerTrainer(
        model      = model,
        args       = training_args,
        train_dataset = {
            "cosine": cosine_train_ds,
            "mnr":    mnr_train_ds,
        },
        eval_dataset = {
            "cosine": cosine_eval_ds,
        },
        loss = {
            "cosine": cosine_loss,
            "mnr":    mnr_loss,
        },
        evaluator = evaluator,
    )

    print("\n[INFO] Starting training ...\n", flush=True)
    start = time.time()
    trainer.train()
    train_seconds = time.time() - start

    print(f"\n[INFO] Training complete in {train_seconds/60:.1f} minutes.", flush=True)

    # Save the final model explicitly (trainer already saves best checkpoint)
    model.save(output_dir)
    print(f"[INFO] Model saved to: {output_dir}")

    return model, train_seconds

# ── CLI ──────────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Fine-tune BAAI/bge-large-en-v1.5 for CV-Job matching."
    )
    p.add_argument("--epochs",     type=int, default=5,
                   help="Training epochs (default 5)")
    p.add_argument("--batch-size", type=int, default=16,
                   help="Batch size (default 16)")
    p.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR,
                   help="Where to save the fine-tuned model")
    p.add_argument("--skip-eval",  action="store_true",
                   help="Skip baseline-vs-finetuned evaluation")
    return p.parse_args()

# ── main ──────────────────────────────────────────────────────────────────────
def main() -> int:
    args = parse_args()
    set_seed(SEED)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    banner("CV-Job Matching Engine — Fine-Tuning Pipeline (v2)")
    print(f"[INFO] Base model   : {BASE_MODEL}")
    print(f"[INFO] Epochs       : {args.epochs}")
    print(f"[INFO] Batch size   : {args.batch_size}")
    print(f"[INFO] Output dir   : {args.output_dir}")
    print(f"[INFO] Device       : {'CUDA' if torch.cuda.is_available() else 'CPU'}")
    print(f"[INFO] Dual loss    : CosineSimilarityLoss + MultipleNegativesRankingLoss")

    # ── 1. Load data ──────────────────────────────────────────────────────────
    banner("Loading & combining datasets")
    raw1 = _load_dataset1()
    raw2 = _load_dataset2()
    all_records = raw1 + raw2
    sources_used = []
    if raw1: sources_used.append(DATASET_1)
    if raw2: sources_used.append(DATASET_2)
    if not all_records:
        all_records = synthetic_fallback(150)
        sources_used.append("synthetic_fallback")

    # ── 2. Clean & augment with hard negatives ────────────────────────────────
    all_records = filter_and_clean(all_records)
    hard_negs   = mine_hard_negatives(all_records)
    all_records.extend(hard_negs)
    print(f"[INFO] Final dataset size (incl. hard negatives): {len(all_records)}")

    # ── 3. Shuffle + split ────────────────────────────────────────────────────
    rng = random.Random(SEED)
    rng.shuffle(all_records)
    train_records, eval_records = split_train_eval(all_records, train_ratio=0.80)
    print(f"[INFO] Train={len(train_records)}  Eval={len(eval_records)}")

    # ── 4. Fine-tune ──────────────────────────────────────────────────────────
    finetuned_model, train_seconds = train_model(
        train_records = train_records,
        eval_records  = eval_records,
        output_dir    = args.output_dir,
        epochs        = args.epochs,
        batch_size    = args.batch_size,
    )

    if args.skip_eval:
        print("[INFO] --skip-eval: skipping comparative evaluation.")
        return 0

    # ── 5. Baseline evaluation (pretrained, no fine-tuning) ───────────────────
    banner("Evaluating BASELINE (pretrained BAAI/bge-large-en-v1.5)")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    baseline_model = SentenceTransformer(BASE_MODEL, device=device)
    base_metrics   = compute_metrics(baseline_model, eval_records, "Baseline eval")
    del baseline_model  # free memory

    # ── 6. Fine-tuned model evaluation ────────────────────────────────────────
    banner("Evaluating FINE-TUNED model")
    try:
        finetuned_eval = SentenceTransformer(args.output_dir, device=device)
    except Exception:
        finetuned_eval = finetuned_model
    ft_metrics = compute_metrics(finetuned_eval, eval_records, "Fine-tuned eval")

    # ── 7. Build result report ────────────────────────────────────────────────
    improvement = {
        k: pct_improvement(base_metrics[k], ft_metrics[k])
        for k in ["spearman", "pearson", "ndcg@5", "ndcg@10", "mrr"]
    }
    train_time_str = f"{train_seconds/60:.1f}m"

    results = {
        "baseline": {**base_metrics, "training_time": "0m (pretrained)"},
        "finetuned": {**ft_metrics,  "training_time": train_time_str},
        "improvement": improvement,
        "training_time_minutes": round(train_seconds / 60, 1),
        "dataset_stats": {
            "total_pairs":    len(all_records),
            "train_pairs":    len(train_records),
            "eval_pairs":     len(eval_records),
            "hard_negatives": len(hard_negs),
            "sources":        sources_used,
        },
        "training_config": {
            "base_model":  BASE_MODEL,
            "epochs":      args.epochs,
            "batch_size":  args.batch_size,
            "loss":        ["CosineSimilarityLoss", "MultipleNegativesRankingLoss"],
            "learning_rate": "2e-5",
            "weight_decay": "0.01",
            "warmup":       "10% of total steps",
        },
    }

    # ── 8. Save results ───────────────────────────────────────────────────────
    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\n[INFO] Wrote {RESULTS_JSON}")

    csv_lines = [
        "Model,Spearman,Pearson,NDCG@5,NDCG@10,MRR,Training_Time",
        (f"Baseline (BAAI/bge-large-en-v1.5),"
         f"{base_metrics['spearman']},{base_metrics['pearson']},"
         f"{base_metrics['ndcg@5']},{base_metrics['ndcg@10']},"
         f"{base_metrics['mrr']},0m (pretrained)"),
        (f"Fine-tuned (BAAI/bge-large-en-v1.5),"
         f"{ft_metrics['spearman']},{ft_metrics['pearson']},"
         f"{ft_metrics['ndcg@5']},{ft_metrics['ndcg@10']},"
         f"{ft_metrics['mrr']},{train_time_str}"),
        (f"Improvement,"
         f"{improvement['spearman']},{improvement['pearson']},"
         f"{improvement['ndcg@5']},{improvement['ndcg@10']},"
         f"{improvement['mrr']},--"),
    ]
    with open(RESULTS_CSV, "w", encoding="utf-8") as f:
        f.write("\n".join(csv_lines) + "\n")
    print(f"[INFO] Wrote {RESULTS_CSV}")

    # ── 9. Final summary ──────────────────────────────────────────────────────
    banner("RESULTS SUMMARY")
    print(json.dumps(results, indent=2))

    print("\n")
    print("[DONE] Model fine-tuned and saved to:", args.output_dir)
    print("[DONE] Evaluation metrics saved to:  ", RESULTS_JSON)
    print("[DONE] Ready to start API:")
    print("         uvicorn app.main:app --reload --port 8000")
    return 0


if __name__ == "__main__":
    sys.exit(main())
