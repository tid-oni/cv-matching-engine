# CV Matching Engine v2

Production-ready CV-to-job-description matching system with domain-adapted semantic search, skill proximity graphs, and URL signal extraction.

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Fine-tune the model (optional but recommended)
```bash
python training/fine_tune.py
```
Downloads datasets from HuggingFace, fine-tunes BAAI/bge-large-en-v1.5 on ~8.7K CV-job pairs, saves to `app/models/cv-matcher-finetuned/`, and generates `results/evaluation_metrics.json`.

### 3. Start the API server
```bash
uvicorn app.main:app --reload --port 8000
```
First start loads the ML models (~30–60s). Health check: http://localhost:8000/health

### 4a. Launch the web app (recommended)
```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```
The web app is the full platform: landing page with a **live match playground**, candidate/recruiter/admin dashboards, JWT auth, and the AI scoring UI. It talks to the API on `:8000`.

### 4b. Or the Streamlit demo
```bash
streamlit run demo.py --server.port 8501   # → http://localhost:8501
```

### Run the tests
```bash
python -m pytest -q
```
Covers password hashing, JWT round-trips, and the AI explanation generator (no model download needed).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/match/text` | Match CV text vs job text |
| POST | `/match/pdf` | Match PDF CV vs job text |
| POST | `/match/batch` | Rank multiple CVs against one job |
| GET | `/history?limit=20` | Past match history |
| GET | `/health` | System health + model status |
| GET | `/metrics` | Aggregate statistics |

Interactive docs: http://localhost:8000/docs

### Example: Text Match
```bash
curl -X POST http://localhost:8000/match/text \
  -H "Content-Type: application/json" \
  -d '{"cv_text": "Python developer, 5 years, FastAPI...", "job_text": "Looking for Python backend engineer..."}'
```

### Example: Batch Match
```bash
curl -X POST http://localhost:8000/match/batch \
  -H "Content-Type: application/json" \
  -d '{"cvs": ["CV text 1...", "CV text 2...", "CV text 3..."], "job_text": "Job description..."}'
```

---

## Architecture

```
Input (CV + Job)
     │
     ├── Language Detection (langdetect)
     │        ├── English → BAAI/bge-large-en-v1.5 (fine-tuned)
     │        └── Other   → BAAI/bge-m3 (multilingual)
     │
     ├── Semantic Score (40%) — cosine similarity of embeddings
     ├── Skill Proximity Score (30%) — graph-based cluster matching
     ├── TF-IDF Score (15%) — keyword overlap
     └── URL Boost (≤15pts) — GitHub/LinkedIn/portfolio signals
              │
              └── Final Score + Rule-based Explanation
```

## Scoring Formula

```
total_score = (semantic × 0.40) + (skill_proximity × 0.30) + (tfidf × 0.15) + min(url_boost, 15)
```

## Models

- **Primary**: `BAAI/bge-large-en-v1.5` — #1 on MTEB benchmark, fine-tuned on CV-job data
- **Multilingual fallback**: `BAAI/bge-m3` — for French, Arabic, Spanish, German, etc.

## Evaluation Results

After fine-tuning on 8,733 CV-job pairs (held-out 1,747-pair eval split). Numbers are the actual output in `results/evaluation_metrics.json`:

| Metric | Baseline | Fine-tuned | Improvement |
|--------|----------|------------|-------------|
| Spearman | 0.233 | 0.817 | +250.9% |
| Pearson  | 0.216 | 0.836 | +287.7% |
| NDCG@10  | 0.561 | 0.561 | +0.0%   |
| MRR      | 0.0071 | 0.0084 | +18.3% |

The fine-tuning win is concentrated in **correlation/calibration** (Spearman, Pearson) — the base model barely correlated with human fit judgments (0.23) and the fine-tuned model tracks them closely (0.82). Ranking quality (NDCG) was already adequate in the base model and stayed flat.

## File Structure

```
cv-matching-engine-v2/
├── app/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── matching.py          # Core matching engine
│   ├── skill_graph.py       # Skill cluster proximity
│   ├── url_reader.py        # GitHub/LinkedIn/portfolio analysis
│   ├── explainer.py         # Rule-based explanation generator
│   ├── pdf_extractor.py     # PDF → text extraction
│   ├── database.py          # SQLite persistence
│   └── models/
│       └── cv-matcher-finetuned/  # Fine-tuned model (after training)
├── data/datasets/           # HuggingFace datasets
├── training/
│   └── fine_tune.py         # Fine-tuning + evaluation script
├── results/
│   ├── evaluation_metrics.json
│   ├── demo_test.json
│   └── model_comparison.csv
├── demo.py                  # Streamlit 3-tab demo
├── requirements.txt
├── README.md
└── REPORT.md                # Academic technical report
```

## Requirements

Python 3.9+ recommended. Key packages:
- `sentence-transformers` — model loading and fine-tuning
- `fastapi` + `uvicorn` — REST API server
- `streamlit` — demo interface
- `langdetect` — language detection
- `pdfplumber` — PDF text extraction
- `beautifulsoup4` — URL/web scraping
- `scikit-learn` — TF-IDF and evaluation metrics
- `sqlalchemy` — SQLite database ORM

## Academic Report

See `REPORT.md` for the full technical report including methodology, experiments, results, and future work.
