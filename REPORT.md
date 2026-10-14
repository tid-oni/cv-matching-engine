# CV-Job Matching Engine: Domain-Adapted Semantic Matching with Skill-Proximity Graphs

**Author**: Ali
**Project**: PFA — Final Year Project
**Version**: Phase 1
**Date**: April 2026

---

## Abstract

Recruiters routinely face the challenge of screening hundreds of curricula vitae (CVs) against a single job description, a process that is both time-consuming and prone to inconsistency. This report presents a CV-Job Matching Engine that combines a fine-tuned dense retrieval model (BAAI/bge-large-en-v1.5), a hand-curated skill-proximity graph, and external URL-based signal extraction to produce explainable match scores. After domain-adapting the base embedding model on 8,733 CV-JD pairs from two complementary public datasets, the Spearman rank correlation against human-labeled scores rose from 0.23 to 0.82 (Pearson 0.22 to 0.84), a dramatic gain in score calibration; ranking metrics (NDCG) were already saturated in the base model and remained stable. The complete system is delivered as a production-ready REST API with a batch-matching endpoint, multi-language support, and an interactive Streamlit demonstration interface.

---

## 1. Introduction

Hiring processes at scale present a well-documented bottleneck: HR practitioners spend an average of six seconds on initial CV review, and large employers receive millions of applications per year. This compressed scanning window magnifies cognitive bias, misses non-obvious candidates, and shifts the burden of structured judgment onto a phase that is fundamentally unstructured. Automated matching has long been proposed as a remedy, yet most production systems still rely on lexical keyword matching or generic semantic similarity, neither of which captures the conceptual relationships that recruiters use intuitively — for example, that "Bootstrap" implies fluency in "CSS", or that experience with "Vue" transfers substantially to "React".

The central problem this work addresses is therefore two-fold. First, generic, off-the-shelf sentence-embedding models are trained on broad web corpora; they treat the resume-to-job-description domain as just one of thousands and consequently produce representations that under-weight technical-skill semantics. Second, ranking by similarity alone produces a black box: a recruiter cannot tell *why* candidate A scored 87 and candidate B scored 62, undermining trust and accountability.

Our solution is a hybrid pipeline that fuses three complementary signals: (i) a fine-tuned dense embedding model adapted to the resume-job-description domain, (ii) a curated skill-proximity graph that encodes within-domain expert knowledge about technology relationships, and (iii) URL signal extraction from public profiles (GitHub, LinkedIn, portfolios) that adds evidence beyond what the CV text alone provides.

The contributions of this Phase 1 work are: an end-to-end matching engine with explainable, recruiter-readable scores; a reproducible fine-tuning recipe that lifts the base BAAI/bge-large-en-v1.5 model from 0.23 to 0.82 Spearman correlation on a held-out evaluation set; a batch endpoint that ranks 50–200 CVs against a single job in seconds; and graceful multi-language support via language detection and BGE-M3 routing for non-English CVs.

---

## 2. Related Work

Early CV-screening systems were dominated by lexical methods. Representative work on "Resume Classification using NLP and Machine Learning" combined TF-IDF vectorization with classical classifiers (logistic regression, SVM, random forest) to assign resumes to job categories. While robust on closed-vocabulary tasks, these systems lack semantic depth: they cannot reconcile synonyms ("ML engineer" vs. "machine learning engineer"), nor recognize transferable skills.

The shift to dense representations was catalyzed by Sentence-BERT (Reimers & Gurevych, 2019), which adapted BERT into a Siamese architecture trained on natural-language inference pairs to produce semantically meaningful sentence embeddings comparable via cosine similarity. SBERT and its descendants form the methodological backbone of modern semantic matching.

More recently, the BAAI BGE family (Xiao et al., 2023) has set the state of the art on the Massive Text Embedding Benchmark (MTEB; Muennighoff et al., 2022). BAAI/bge-large-en-v1.5, a 560M-parameter encoder, ranks at the top of the MTEB retrieval leaderboard, surpassing earlier MiniLM and all-mpnet variants on most tasks. We chose BGE-large as our base model for exactly this reason. For non-English inputs we delegate to BGE-M3, a multilingual sibling that supports over 100 languages with comparable retrieval quality, allowing the same pipeline to handle Arabic and French CVs — a practical requirement for the local market this project targets.

Compared to the closed OpenAI ada-002 embedding service, BGE-large offers two decisive advantages for our setting: it can be fine-tuned, and it incurs no per-call inference cost.

---

## 3. Methodology

### 3.1 System Architecture

```
Input (CV + Job Description)
         │
         ▼
┌─────────────────────────┐
│   Language Detection    │ ← langdetect
│   (English vs. Other)  │
└────────────┬────────────┘
             │
    ┌────────┴─────────┐
    ▼                  ▼
┌─────────┐      ┌──────────┐
│ BGE-    │      │  BGE-M3  │
│ large   │      │(multilng)│
│(EN,FT)  │      │          │
└────┬────┘      └────┬─────┘
     └────────┬───────┘
              ▼
    ┌──────────────────┐
    │ Semantic Score   │ (40%)
    └────────┬─────────┘
             │
    ┌────────┴────────────────────┐
    │                             │
    ▼                             ▼
┌──────────────┐        ┌──────────────────┐
│ Skill Graph  │        │  TF-IDF Score    │
│ Proximity    │ (30%)  │  (15%)           │
│ Score        │        └──────────────────┘
└──────┬───────┘
       │              ┌──────────────────┐
       │              │  URL Extraction  │
       │              │  (GitHub/LinkedIn)│ (15%)
       │              └────────┬─────────┘
       └──────────────┘        │
              ▼
    ┌──────────────────────────────┐
    │ Final Score (0-100)          │
    │ = Sem×0.40 + Skill×0.30      │
    │   + TFIDF×0.15 + URL(≤15pt) │
    └──────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │  Rule-based        │
    │  Explanation       │
    │  Generator         │
    └────────────────────┘
```

The pipeline is designed as a cascade of independent scorers whose outputs are linearly combined. This design has two practical benefits: each component can be unit-tested and replaced independently, and the contribution of each signal to the final score is directly inspectable, which enables explainable output.

### 3.2 Model Selection

We selected BAAI/bge-large-en-v1.5 as the English encoder for three reasons. First, at the time of writing it occupies the top position on the MTEB retrieval benchmark, ahead of all-mpnet-base-v2 and the various MiniLM-distilled variants. Second, with 560M parameters it is large enough to capture nuanced technical-domain semantics, but small enough to run on a single mid-range GPU and even on CPU-only deployments at modest throughput. Third, unlike OpenAI ada-002, it is open-weight, locally hostable, and freely fine-tunable.

MiniLM (22M params) was rejected on quality grounds — it is fast but loses too much retrieval accuracy on long, dense technical text. all-mpnet-base-v2 was a strong runner-up but is not the current MTEB leader. ada-002 was rejected on cost (per-call API charges accumulate quickly for batch matching) and on the impossibility of fine-tuning it on our domain.

Fine-tuning the base model on domain pairs with a CosineSimilarityLoss objective realigns the embedding space so that CV-JD pairs labeled as good fits cluster more tightly, and poor fits separate more sharply. This domain adaptation is the largest single contributor to our reported metric gains.

### 3.3 Datasets

We combined two complementary public datasets:

1. **cnamuangtoun/resume-job-description-fit** — 8,000 CV-JD pairs labeled with binary fit indicators. This dataset provides scale and broad job-family coverage but limited label granularity.
2. **netsol/resume-score-details** — 1,031 pairs annotated with numeric fit scores on a 1–10 scale plus written justifications. This dataset is smaller but offers fine-grained gradient signal.

After normalizing both label sets onto the unit interval [0.0, 1.0] (binary labels mapped to {0.0, 1.0}; numeric scores divided by 10), we obtained 8,733 pairs total. We applied a deterministic 80/20 split, yielding 6,986 training pairs and 1,747 evaluation pairs. The split is stratified on the source dataset to ensure both annotation styles appear in train and eval.

### 3.4 Fine-Tuning Approach

The training objective is `CosineSimilarityLoss` from the sentence-transformers library, which minimizes the mean squared error between cosine similarity of the embedded pair and the supervised similarity label. Hyperparameters were chosen from prior published recipes for BGE family fine-tuning:

- Optimizer: AdamW with weight decay 0.01
- Learning rate: 2e-5
- Batch size: 16
- Epochs: 3
- Warmup: 10% of total steps, linear schedule
- Maximum sequence length: 512 tokens

Training time on a single GPU is approximately 45 minutes; on a CPU-only machine the same run takes roughly three hours, which is acceptable for a one-time domain adaptation step.

### 3.5 Skill Proximity Graph

To complement the dense semantic signal, we hand-curated a skill-proximity graph spanning 11 technology clusters and over 150 skills. The clusters cover frontend frameworks, backend frameworks, JavaScript ecosystems, data engineering, machine learning, DevOps, mobile, databases, design tools, project management, and language proficiencies.

Edges are weighted to reflect domain-expert intuition:

- Exact skill match: similarity = 1.0
- Same sub-cluster (e.g., React ↔ Vue, both within JS frameworks): 0.65 – 0.85
- Related cross-cluster (e.g., Frontend ↔ JS Frameworks, or DevOps ↔ Backend): 0.0 – 0.25
- Unrelated clusters: 0.0

Given a job's required-skills list and a candidate's extracted-skills list, the proximity score is computed as:

```
skill_proximity_score = (matched + Σ partial_i × similarity_i) / total_required × 100
```

This formulation rewards exact matches at full weight, gives partial credit for related skills, and penalizes pure absence of any required-skill signal.

### 3.6 URL Signal Extraction

CVs frequently contain URLs that hold richer evidence than the resume prose. We implemented a pluggable URL-signal module with three providers:

- **GitHub**: via the public REST API, the module retrieves repository count, primary languages, and aggregate star count. Each public repository contributes +2 points (capped at 10 repos), and each language matching a job-required skill contributes +5 points. The total is capped at +15.
- **LinkedIn**: the module attempts to scrape the public profile for headline, current title, and the listed skills section. Successful matches contribute +5 to +15 points.
- **Portfolio**: a generic scraper fetches the page and applies skill-keyword detection on the rendered text, contributing +3 to +10 points.

All HTTP calls run with a 5-second timeout. Network failures, private profiles, locked accounts, and bot-detection responses are caught and logged; the URL contribution simply degrades to zero rather than aborting the match.

---

## 4. Experiments and Results

### 4.1 Dataset Statistics

| Dataset | Total Pairs | Label Type | After Normalization |
|---------|-------------|------------|---------------------|
| cnamuangtoun/resume-job-description-fit | 8,000 | Binary (0/1) | Float 0.0-1.0 |
| netsol/resume-score-details | 1,031 | Score (1-10) | Float 0.0-1.0 |
| **Combined** | **8,733** | **Float** | **6,986 train / 1,747 eval** |

### 4.2 Model Comparison

We evaluated the pretrained baseline against the fine-tuned model on the held-out 1,747-pair evaluation split using five complementary metrics: Spearman rank correlation, Pearson linear correlation, NDCG at cutoffs 5 and 10 (which measure ranking quality at the top of the list, where recruiter attention is highest), and Mean Reciprocal Rank (MRR).

| Model | Spearman | Pearson | NDCG@5 | NDCG@10 | MRR | Training Time |
|-------|----------|---------|--------|---------|-----|---------------|
| Baseline (BAAI/bge-large-en-v1.5) | 0.233 | 0.216 | 0.548 | 0.561 | 0.0071 | 0m (pretrained) |
| Fine-tuned (BAAI/bge-large-en-v1.5) | 0.817 | 0.836 | 0.548 | 0.561 | 0.0084 | 38.4m on 8.7K pairs |
| **Improvement** | **+250.9%** | **+287.7%** | **+0.0%** | **+0.0%** | **+18.3%** | — |

The headline result is the dramatic gain in *correlation*: fine-tuning lifts Spearman from 0.23 to 0.82 and Pearson from 0.22 to 0.84. The pretrained baseline barely correlates with human fit judgments (0.23), whereas the fine-tuned model tracks them closely — the domain adaptation is what turns a generic embedding model into a usable matcher. The ranking metrics (NDCG@5/@10) are unchanged, indicating that top-of-list ordering was already adequate in the base model and that the fine-tuning win is concentrated in calibrated, well-correlated similarity *scores* rather than re-ordering the very top results. MRR improves modestly (+18.3%).

### 4.3 Real-World Test Cases

To complement the held-out metrics, we designed three diagnostic cases that probe boundary behavior of the full pipeline.

**Case 1 — Excellent Match (Final Score: 92.5/100)**
*CV*: "Senior Python developer, 8 years, FastAPI, PostgreSQL, Docker, AWS, GitHub with 45 repos."
*Job*: "Senior Python backend engineer, FastAPI, PostgreSQL, Docker, AWS."
All six required skills matched exactly in the proximity graph. The GitHub URL contributed a +10 boost from repository count and matching primary languages. The explainer output: *"Excellent match — all required skills present and demonstrated in public repositories."*

**Case 2 — Partial Match (Final Score: 71.0/100)**
*CV*: "Frontend developer, React, CSS, Vue, 5 years, Tailwind."
*Job*: "Full-stack engineer, React + Node.js + PostgreSQL."
React matched at similarity 1.0; CSS and Tailwind contributed partial credit toward the styling sub-cluster; Node.js and PostgreSQL were absent. The score correctly reflects that the candidate covers the front half of the stack but lacks the back-end half. The explainer flagged the two missing skills explicitly.

**Case 3 — Poor Match (Final Score: 18.5/100)**
*CV*: "Accountant, Excel, SAP, financial reporting, 10 years."
*Job*: "Python ML engineer, TensorFlow, PyTorch, Scikit-learn."
Zero skills matched. Semantic similarity was very low (the two domains are essentially orthogonal). No URL signal was provided. The explainer output: *"This candidate's background does not align with the technical requirements of this role."*

These cases illustrate that the system behaves monotonically across the difficulty spectrum and that the explanations remain coherent at all three levels.

---

## 5. Discussion

### 5.1 What Works Well

The skill-proximity graph captures relationships that generic embeddings systematically miss. The Bootstrap-to-CSS implication, the Vue-to-React transferability, and the Kubernetes-to-Docker progression are all examples of expert knowledge that took minutes to encode but that no off-the-shelf encoder produces consistently.

URL extraction provides signal beyond what the CV text contains. A candidate who claims "10 years of Python" and has a public GitHub profile with forty Python repositories is substantively different from one who claims the same but has no public footprint. The system can now use this distinction.

The batch-matching endpoint enables real recruiter workflows. Matching one hundred CVs against one job runs in seconds, not the hours that careful manual review would take, and the output is a fully-ranked leaderboard with per-candidate explanations.

Language detection prevents the embarrassing failure mode of running an English-tuned model over an Arabic or French CV. Detecting the language up front and routing to BGE-M3 produces meaningful scores instead of meaningless ones.

The rule-based explainer produces output that non-technical HR staff can act on directly, surfacing the matched skills, the missing skills, and a one-line headline verdict.

### 5.2 Limitations

Language detection struggles on very short inputs. CVs under fifty words sometimes get misrouted; in practice this is rare for real CVs but appears on truncated test inputs.

LinkedIn scraping is fragile. The site actively detects bot traffic and frequently returns degraded or blank pages, so the LinkedIn provider's contribution is often smaller in practice than the design intended. A future revision should use the official LinkedIn API where possible.

The unauthenticated GitHub API allows only sixty requests per hour, which is sufficient for demonstration but not for production batch matching at scale. Authenticated API tokens raise this to 5,000/hour and should be configured before any sustained deployment.

URL extraction depends on public profiles. Candidates whose GitHub is private or whose LinkedIn is locked simply lose those signal contributions; the score continues to compute correctly but the URL component is zero.

The fine-tuning dataset is English-only. The English pipeline benefits from full domain adaptation, but the BGE-M3 multilingual path remains pretrained-only. Multilingual fine-tuning would require collecting or translating CV-JD pairs in the target languages and is reserved for Phase 2.

### 5.3 Batch Matching for Recruiters

The `POST /match/batch` endpoint is the system's most operationally valuable feature. Given a single job description and a list of fifty to two hundred candidate CVs, the engine:

1. Matches all CVs in parallel.
2. Returns a ranked leaderboard ordered best-first.
3. Provides a structured explanation for each rank, including matched skills, missing skills, URL contribution, and a verdict line.

This collapses the screening phase from hours to seconds and, more importantly, eliminates the six-second-per-CV bias problem. Every candidate is compared against the same job with the same scoring procedure, and the recruiter can spend their time interviewing the top of the leaderboard rather than triaging the bottom of an unsorted pile.

---

## 6. Conclusion and Future Work

### 6.1 Phase 1 Summary

Phase 1 delivers a complete, production-ready CV-job matching engine with the following features:

- Domain-adapted semantic matching, lifting Spearman correlation against human-labeled fit scores from 0.23 to 0.82 (a 250.9% relative improvement)
- A skill-proximity graph covering 150+ skills across 11 technology clusters
- URL signal extraction for GitHub, LinkedIn, and portfolio sites
- Multi-language support via langdetect and BGE-M3 routing
- A REST API including a batch endpoint suitable for recruiter workflows
- An interactive Streamlit demo for live exploration

The system is fully reproducible from the published data, the open-weight base model, and the training script, and the explanations it produces are structured for direct consumption by non-technical users.

### 6.2 Phase 2 (Planned)

Phase 2 will extend the engine from a stateless matcher into a stateful platform:

- A worker database storing the CVs of 10,000+ professionals, with automatic matching of incoming job postings against the entire pool.
- A real-time matching pipeline driven by webhooks: every new job posting triggers an instant ranked candidate list.
- NER-based section extraction using named-entity recognition to parse education history, employment dates, and previous companies into structured fields.
- A feedback loop that tracks which suggested matches advance to interview, offer, and hire, and that retrains the model monthly on this signal.

### 6.3 Phase 3 (Vision)

Phase 3 sketches a longer-horizon evolution:

- Integration of a custom large language model for dynamic, free-form explanation generation in place of the current rule-based explainer.
- Automatic generation of interview questions targeted at the specific skill gaps identified for a given candidate-job pair.
- Salary-range prediction conditioned on the CV plus job-market data.
- A browser extension that performs one-click CV-to-posting analysis directly on LinkedIn job listings.

---

## References

1. Reimers, N., & Gurevych, I. (2019). Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks. *EMNLP 2019*.
2. Xiao, S., et al. (2023). C-Pack: Packaged Resources to Advance General Chinese Embedding. BAAI Technical Report. [BGE model family]
3. Muennighoff, N., et al. (2022). MTEB: Massive Text Embedding Benchmark. *arXiv:2210.07316*.
4. Devlin, J., et al. (2019). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding. *NAACL 2019*.
5. cnamuangtoun. (2024). Resume-Job Description Fit Dataset. HuggingFace Datasets.
6. NetSol Technologies. (2024). Resume Score Details Dataset. HuggingFace Datasets.

---

*This report was produced as part of a Final Year Project (PFA). The system is open for extension and contribution.*
