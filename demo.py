"""
CV Matching Engine v2 - Streamlit Demo Application
Portfolio / PFA Presentation
"""

import json
import os
from io import BytesIO

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st

# ============================================================================
# CONFIGURATION
# ============================================================================

API_BASE = "http://localhost:8000"
EVAL_METRICS_PATH = "results/evaluation_metrics.json"

st.set_page_config(
    page_title="CV Matching Engine v2",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================================
# CUSTOM CSS
# ============================================================================

CUSTOM_CSS = """
<style>
    /* Wider main container */
    .main .block-container {
        max-width: 1400px;
        padding-top: 2rem;
        padding-bottom: 2rem;
    }

    /* Card-style metric boxes */
    div[data-testid="stMetric"] {
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fc 100%);
        border: 1px solid #e3e6ed;
        border-radius: 12px;
        padding: 18px 22px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    div[data-testid="stMetric"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(0,0,0,0.08);
    }

    /* Better fonts for score display */
    div[data-testid="stMetricValue"] {
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
        font-weight: 700;
        font-size: 2rem;
        color: #2c3e50;
    }
    div[data-testid="stMetricLabel"] {
        font-family: 'Segoe UI', sans-serif;
        font-weight: 500;
        color: #7f8c8d;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 0.8rem;
    }

    /* Headings */
    h1, h2, h3 {
        font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
        color: #1a2433;
    }

    /* Tabs */
    button[data-baseweb="tab"] {
        font-size: 1.05rem;
        font-weight: 600;
    }

    /* Sidebar header */
    .sidebar-title {
        font-size: 1.4rem;
        font-weight: 700;
        color: #2c3e50;
        margin-bottom: 0.2rem;
    }
    .sidebar-subtitle {
        font-size: 0.85rem;
        color: #7f8c8d;
        margin-bottom: 1rem;
    }

    /* Status indicator dot */
    .status-dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 8px;
        vertical-align: middle;
    }
    .status-online { background-color: #2ecc71; box-shadow: 0 0 8px #2ecc71; }
    .status-offline { background-color: #e74c3c; box-shadow: 0 0 8px #e74c3c; }

    /* Result card */
    .result-card {
        background: #ffffff;
        border: 1px solid #e3e6ed;
        border-radius: 12px;
        padding: 18px;
        margin-bottom: 14px;
    }

    /* Skill chips */
    .skill-chip {
        display: inline-block;
        padding: 4px 10px;
        margin: 3px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 500;
    }
    .skill-found { background: #d5f5e3; color: #186a3b; border: 1px solid #82e0aa; }
    .skill-missing { background: #fadbd8; color: #922b21; border: 1px solid #f1948a; }

    /* Buttons */
    .stButton>button[kind="primary"] {
        font-weight: 600;
        border-radius: 8px;
        padding: 0.5rem 1.2rem;
    }
</style>
"""

st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ============================================================================
# SAMPLE DATA
# ============================================================================

SAMPLE_CV = """John Smith
Senior Software Engineer | 8 years experience
Email: john.smith@email.com | GitHub: github.com/johnsmith

SKILLS
Python, FastAPI, PostgreSQL, Docker, AWS, React, Git

EXPERIENCE
Senior Backend Engineer - TechCorp (2020-2024)
- Built REST APIs using FastAPI serving 1M+ requests/day
- Managed PostgreSQL databases with complex query optimization
- Deployed microservices on AWS ECS with Docker

Software Engineer - StartupXYZ (2018-2020)
- Developed Flask applications with PostgreSQL backend
- Implemented CI/CD pipelines using GitHub Actions

EDUCATION
B.S. Computer Science - State University (2018)
"""

SAMPLE_JOB = """Senior Python Backend Engineer

We are looking for a Senior Python Backend Engineer to join our team.

Requirements:
- 5+ years Python experience
- FastAPI or Django REST framework
- PostgreSQL or MySQL database expertise
- Docker and Kubernetes knowledge
- AWS or GCP cloud experience
- Experience with microservices architecture

Nice to have:
- React or Vue frontend knowledge
- CI/CD pipeline experience
"""

# ============================================================================
# API HELPERS
# ============================================================================

def call_match_text(cv_text, job_text):
    try:
        r = requests.post(
            f"{API_BASE}/match/text",
            json={"cv_text": cv_text, "job_text": job_text},
            timeout=60,
        )
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)


def call_match_pdf(pdf_bytes, filename, job_text):
    """Call the /match/pdf endpoint with an uploaded PDF file."""
    try:
        files = {"cv_file": (filename, pdf_bytes, "application/pdf")}
        data = {"job_text": job_text}
        r = requests.post(
            f"{API_BASE}/match/pdf",
            files=files,
            data=data,
            timeout=90,
        )
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)


def call_match_batch(cvs, job_text):
    try:
        r = requests.post(
            f"{API_BASE}/match/batch",
            json={"cvs": cvs, "job_text": job_text},
            timeout=120,
        )
        r.raise_for_status()
        return r.json(), None
    except Exception as e:
        return None, str(e)


def get_health():
    try:
        r = requests.get(f"{API_BASE}/health", timeout=5)
        return r.json()
    except Exception:
        return {"status": "offline", "models_loaded": False, "uptime_seconds": 0}


def get_metrics():
    try:
        r = requests.get(f"{API_BASE}/metrics", timeout=5)
        return r.json()
    except Exception:
        return None


@st.cache_data(ttl=60)
def cached_health():
    return get_health()


@st.cache_data(ttl=60)
def cached_metrics():
    return get_metrics()


# ============================================================================
# CHART HELPERS
# ============================================================================

def make_gauge(score):
    color = "#2ecc71" if score >= 70 else "#f39c12" if score >= 50 else "#e74c3c"
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=score,
        domain={"x": [0, 1], "y": [0, 1]},
        title={"text": "Match Score", "font": {"size": 24}},
        gauge={
            "axis": {"range": [0, 100], "tickwidth": 1},
            "bar": {"color": color},
            "bgcolor": "white",
            "steps": [
                {"range": [0, 50], "color": "#fadbd8"},
                {"range": [50, 70], "color": "#fdebd0"},
                {"range": [70, 100], "color": "#d5f5e3"},
            ],
            "threshold": {
                "line": {"color": "red", "width": 4},
                "thickness": 0.75,
                "value": 50,
            },
        },
    ))
    fig.update_layout(height=300, margin=dict(l=20, r=20, t=60, b=20))
    return fig


def make_score_breakdown(result):
    categories = ["Semantic", "Skill Proximity", "TF-IDF", "URL Boost"]
    values = [
        result.get("semantic_score", 0),
        result.get("skill_proximity_score", 0),
        result.get("tfidf_score", 0),
        result.get("url_boost", 0) * 6.67,  # scale to 0-100
    ]
    colors = ["#3498db", "#9b59b6", "#1abc9c", "#e67e22"]
    fig = go.Figure(go.Bar(
        x=values,
        y=categories,
        orientation="h",
        marker_color=colors,
        text=[f"{v:.1f}" for v in values],
        textposition="outside",
    ))
    fig.update_layout(
        title="Score Breakdown",
        height=250,
        xaxis=dict(range=[0, 100]),
        margin=dict(l=20, r=20, t=40, b=20),
    )
    return fig


def color_score_row(row):
    """Return a list of CSS styles for a dataframe row based on the Score column."""
    try:
        score = float(row["Score"])
    except Exception:
        return ["" for _ in row]
    if score >= 70:
        bg = "background-color: #d5f5e3; color: #186a3b;"
    elif score >= 50:
        bg = "background-color: #fdebd0; color: #7d6608;"
    else:
        bg = "background-color: #fadbd8; color: #922b21;"
    return [bg for _ in row]


# ============================================================================
# SIDEBAR
# ============================================================================

def render_sidebar():
    with st.sidebar:
        st.markdown('<div class="sidebar-title">🎯 CV Matching Engine v2</div>',
                    unsafe_allow_html=True)
        st.markdown(
            '<div class="sidebar-subtitle">Hybrid semantic + skill-aware CV/Job matcher</div>',
            unsafe_allow_html=True,
        )

        health = cached_health()
        is_online = health.get("status") not in (None, "offline")

        if is_online:
            st.markdown(
                '<div><span class="status-dot status-online"></span>'
                '<b>API Online</b></div>',
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                '<div><span class="status-dot status-offline"></span>'
                '<b>API Offline</b></div>',
                unsafe_allow_html=True,
            )

        st.markdown("---")
        st.markdown(
            "**About**\n\n"
            "This engine combines:\n"
            "- Fine-tuned **sentence-transformers** for semantic similarity\n"
            "- **Skill ontology** with proximity scoring\n"
            "- **TF-IDF** lexical signal\n"
            "- URL / portfolio boosts\n\n"
            "Backend: FastAPI · Frontend: Streamlit"
        )

        st.markdown("---")
        st.caption(f"API endpoint: `{API_BASE}`")

        if st.button("🔄 Refresh API status"):
            cached_health.clear()
            cached_metrics.clear()
            st.rerun()

        return is_online, health


# ============================================================================
# RESULT RENDERING
# ============================================================================

def render_skills_tables(found, missing):
    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown("##### ✅ Skills Found")
        if found:
            df = pd.DataFrame({"Skill": found})
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.caption("No matched skills detected.")

    with col_b:
        st.markdown("##### ❌ Skills Missing")
        if missing:
            df = pd.DataFrame({"Skill": missing})
            st.dataframe(df, use_container_width=True, hide_index=True)
        else:
            st.caption("No missing skills — great match!")


def render_result(result):
    score = float(result.get("final_score", result.get("score", 0)))

    # Top metrics row
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.metric("Final Score", f"{score:.1f}")
    with m2:
        st.metric("Semantic", f"{result.get('semantic_score', 0):.1f}")
    with m3:
        st.metric("Skill Proximity", f"{result.get('skill_proximity_score', 0):.1f}")
    with m4:
        st.metric("TF-IDF", f"{result.get('tfidf_score', 0):.1f}")

    # Gauge + bar chart
    g1, g2 = st.columns([1, 1])
    with g1:
        st.plotly_chart(make_gauge(score), use_container_width=True)
    with g2:
        st.plotly_chart(make_score_breakdown(result), use_container_width=True)

    # Explanation
    explanation = result.get("explanation") or result.get("reasoning")
    if explanation:
        st.markdown("##### 🧠 Match Explanation")
        st.info(explanation)

    # Skills tables
    found = result.get("matched_skills") or result.get("skills_found") or []
    missing = result.get("missing_skills") or result.get("skills_missing") or []
    render_skills_tables(found, missing)

    # URLs
    urls = result.get("urls_detected") or result.get("urls") or []
    if urls:
        st.markdown("##### 🔗 URLs Detected")
        for u in urls:
            if isinstance(u, dict):
                label = u.get("type", "link")
                url = u.get("url", "")
                st.markdown(f"- **{label}**: [{url}]({url})")
            else:
                st.markdown(f"- [{u}]({u})")


# ============================================================================
# TAB 1: SINGLE MATCH
# ============================================================================

def tab_single_match(api_online):
    st.markdown("### 🎯 Single CV → Job Match")
    st.caption(
        "Paste a CV and a job description, then run the hybrid matcher to get a "
        "score, breakdown, and skill-level diagnostics."
    )

    left, right = st.columns([1, 1.1])

    with left:
        input_mode = st.radio(
            "Input mode",
            ["Paste CV Text", "Upload PDF"],
            horizontal=True,
            key="single_input_mode",
        )

        cv_text = None
        pdf_bytes = None
        pdf_name = None

        if input_mode == "Paste CV Text":
            cv_text = st.text_area(
                "CV Text",
                value=SAMPLE_CV,
                height=300,
                key="single_cv_text",
                help="Paste the candidate CV as plain text.",
            )
        else:
            uploaded = st.file_uploader(
                "Upload CV (PDF)",
                type=["pdf"],
                key="single_cv_pdf",
            )
            if uploaded is not None:
                pdf_bytes = uploaded.read()
                pdf_name = uploaded.name
                st.success(f"Loaded `{pdf_name}` ({len(pdf_bytes) / 1024:.1f} KB)")

        st.markdown("---")

        job_text = st.text_area(
            "Job Description",
            value=SAMPLE_JOB,
            height=200,
            key="single_job_text",
            help="Paste the target job description.",
        )

        run = st.button(
            "🚀 Match Now",
            type="primary",
            use_container_width=True,
            disabled=not api_online,
        )

        if not api_online:
            st.warning(
                "API is offline. Start the FastAPI server with:\n\n"
                "`uvicorn app.main:app --reload --port 8000`"
            )

    with right:
        if run:
            if not job_text or not job_text.strip():
                st.error("Please provide a job description.")
            elif input_mode == "Paste CV Text" and (not cv_text or not cv_text.strip()):
                st.error("Please provide CV text.")
            elif input_mode == "Upload PDF" and pdf_bytes is None:
                st.error("Please upload a PDF file.")
            else:
                with st.spinner("Running hybrid matcher..."):
                    if input_mode == "Paste CV Text":
                        result, err = call_match_text(cv_text, job_text)
                    else:
                        result, err = call_match_pdf(pdf_bytes, pdf_name, job_text)

                if err:
                    st.error(f"API call failed: {err}")
                    st.session_state.pop("single_result", None)
                else:
                    st.session_state["single_result"] = result

        if "single_result" in st.session_state:
            render_result(st.session_state["single_result"])
        else:
            st.markdown(
                "<div class='result-card' style='text-align:center;color:#7f8c8d;'>"
                "<h4>Results will appear here</h4>"
                "<p>Fill in the CV and job description, then click "
                "<b>Match Now</b>.</p>"
                "</div>",
                unsafe_allow_html=True,
            )


# ============================================================================
# TAB 2: BATCH MATCHING
# ============================================================================

def tab_batch(api_online):
    st.markdown("### 📊 Batch CV Ranking")
    st.caption(
        "Rank multiple candidates against a single job description. Paste CVs "
        "(separated by `---` or blank lines) or upload several PDFs."
    )

    job_text = st.text_area(
        "Paste Job Description",
        value=SAMPLE_JOB,
        height=180,
        key="batch_job_text",
    )

    cv_source = st.radio(
        "CV input mode",
        ["Paste multiple CVs", "Upload multiple PDFs"],
        horizontal=True,
        key="batch_input_mode",
    )

    cvs = []

    if cv_source == "Paste multiple CVs":
        st.caption(
            "Separate CVs with a line containing `---` (recommended), or use "
            "double blank lines."
        )
        default_batch = (
            SAMPLE_CV
            + "\n---\n"
            + "Jane Doe\nJunior Frontend Developer\nSkills: HTML, CSS, "
              "JavaScript, React. 2 years experience.\n"
            + "---\n"
            + "Ahmed Ben Ali\nDevOps Engineer\nSkills: Docker, Kubernetes, "
              "AWS, Terraform, Python, CI/CD. 6 years experience."
        )
        bulk = st.text_area(
            "Paste CVs",
            value=default_batch,
            height=260,
            key="batch_cvs_text",
        )
        if bulk and bulk.strip():
            if "---" in bulk:
                parts = [p.strip() for p in bulk.split("---")]
            else:
                parts = [p.strip() for p in bulk.split("\n\n\n")]
            cvs = [p for p in parts if p]
    else:
        files = st.file_uploader(
            "Upload PDF CVs",
            type=["pdf"],
            accept_multiple_files=True,
            key="batch_cvs_pdf",
        )
        if files:
            st.info(
                f"{len(files)} PDF(s) selected. PDFs will be sent to "
                "`/match/pdf` individually and aggregated."
            )
            for f in files:
                cvs.append({"_pdf_name": f.name, "_pdf_bytes": f.read()})

    run = st.button(
        "🏁 Rank CVs",
        type="primary",
        use_container_width=True,
        disabled=not api_online,
    )

    if not api_online:
        st.warning("API is offline. Start the FastAPI server to enable batch ranking.")
        return

    if run:
        if not job_text or not job_text.strip():
            st.error("Please provide a job description.")
            return
        if not cvs:
            st.error("Please provide at least one CV.")
            return

        with st.spinner(f"Matching {len(cvs)} CV(s)..."):
            if cv_source == "Paste multiple CVs":
                data, err = call_match_batch(cvs, job_text)
                if err:
                    st.error(f"Batch API call failed: {err}")
                    return
                results = data.get("results", data) if isinstance(data, dict) else data
            else:
                # Aggregate PDF calls one by one
                results = []
                for item in cvs:
                    res, err = call_match_pdf(
                        item["_pdf_bytes"], item["_pdf_name"], job_text
                    )
                    if err:
                        st.warning(f"Skipping {item['_pdf_name']}: {err}")
                        continue
                    res["_label"] = item["_pdf_name"]
                    results.append(res)
                results = sorted(
                    results,
                    key=lambda r: r.get("final_score", r.get("score", 0)),
                    reverse=True,
                )

            st.session_state["batch_results"] = results

    if "batch_results" in st.session_state:
        results = st.session_state["batch_results"]
        if not results:
            st.info("No results to display.")
            return

        rows = []
        for i, r in enumerate(results, start=1):
            score = float(r.get("final_score", r.get("score", 0)))
            label = r.get("_label") or r.get("cv_label") or ""
            preview = (r.get("cv_preview") or label or "")[:80]
            if not preview:
                # fallback: try matched skills as preview
                preview = ", ".join((r.get("matched_skills") or [])[:3])[:80]
            matched = ", ".join(r.get("matched_skills") or r.get("skills_found") or [])
            missing = ", ".join(r.get("missing_skills") or r.get("skills_missing") or [])
            rows.append({
                "Rank": i,
                "Score": round(score, 2),
                "Preview": preview,
                "Matched Skills": matched,
                "Missing Skills": missing,
            })

        df = pd.DataFrame(rows)

        st.markdown("##### 🏆 Ranked Candidates")
        styled = df.style.apply(color_score_row, axis=1).format({"Score": "{:.2f}"})
        st.dataframe(styled, use_container_width=True, hide_index=True)

        # Summary metrics
        c1, c2, c3 = st.columns(3)
        with c1:
            st.metric("Total CVs", len(df))
        with c2:
            st.metric("Top Score", f"{df['Score'].max():.1f}")
        with c3:
            st.metric("Average", f"{df['Score'].mean():.1f}")
    else:
        st.info("Submit a batch to see ranked results here.")


# ============================================================================
# TAB 3: MODEL INFO
# ============================================================================

def render_eval_metrics():
    if not os.path.exists(EVAL_METRICS_PATH):
        st.info(
            f"No evaluation metrics file found at `{EVAL_METRICS_PATH}`. "
            "Run the evaluation script to generate it."
        )
        return

    try:
        with open(EVAL_METRICS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        st.error(f"Failed to load evaluation metrics: {e}")
        return

    st.markdown("##### 📈 Baseline vs Fine-Tuned")

    baseline = data.get("baseline") or data.get("base") or {}
    finetuned = data.get("fine_tuned") or data.get("finetuned") or {}

    if baseline or finetuned:
        keys = sorted(set(list(baseline.keys()) + list(finetuned.keys())))
        rows = []
        for k in keys:
            b = baseline.get(k)
            f_ = finetuned.get(k)
            delta = ""
            try:
                if b is not None and f_ is not None:
                    delta = f"{(float(f_) - float(b)):+.4f}"
            except Exception:
                delta = ""
            rows.append({
                "Metric": k,
                "Baseline": b,
                "Fine-tuned": f_,
                "Δ": delta,
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
    else:
        # Fall back to flat dict
        st.json(data)

    # Dataset stats if present
    dataset_stats = data.get("dataset") or data.get("dataset_stats")
    if dataset_stats:
        st.markdown("##### 📚 Dataset Statistics")
        if isinstance(dataset_stats, dict):
            st.dataframe(
                pd.DataFrame(dataset_stats.items(), columns=["Field", "Value"]),
                use_container_width=True,
                hide_index=True,
            )
        else:
            st.write(dataset_stats)


def tab_model_info():
    st.markdown("### ℹ️ Model & System Info")

    health = cached_health()
    metrics = cached_metrics()

    # Status row
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        status = health.get("status", "unknown")
        st.metric("API Status", status.upper())
    with c2:
        loaded = health.get("models_loaded", False)
        st.metric("Models Loaded", "Yes" if loaded else "No")
    with c3:
        uptime = float(health.get("uptime_seconds", 0) or 0)
        if uptime > 3600:
            ut_str = f"{uptime / 3600:.1f} h"
        elif uptime > 60:
            ut_str = f"{uptime / 60:.1f} min"
        else:
            ut_str = f"{uptime:.0f} s"
        st.metric("Uptime", ut_str)
    with c4:
        total = 0
        if metrics and isinstance(metrics, dict):
            total = metrics.get("total_matches") or metrics.get("matches_total") or 0
        st.metric("Total Matches", f"{total}")

    st.markdown("---")

    # Models loaded section
    st.markdown("##### 🤖 Loaded Models")
    models_info = health.get("models") or health.get("models_info") or {}
    if models_info:
        if isinstance(models_info, dict):
            rows = [{"Model": k, "Value": str(v)} for k, v in models_info.items()]
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        elif isinstance(models_info, list):
            st.dataframe(pd.DataFrame(models_info), use_container_width=True,
                         hide_index=True)
        else:
            st.write(models_info)
    else:
        st.caption(
            "No detailed model info exposed by `/health`. "
            "(Status reports only `models_loaded` flag.)"
        )

    st.markdown("---")

    # Evaluation metrics
    render_eval_metrics()

    st.markdown("---")

    # Raw metrics endpoint
    st.markdown("##### 📡 `/metrics` Endpoint")
    if metrics is None:
        st.warning("`/metrics` endpoint not reachable.")
    else:
        st.json(metrics)


# ============================================================================
# MAIN
# ============================================================================

def main():
    api_online, health = render_sidebar()

    st.markdown(
        "<h1 style='margin-bottom:0;'>🎯 CV Matching Engine "
        "<span style='color:#3498db;'>v2</span></h1>"
        "<p style='color:#7f8c8d;margin-top:4px;'>"
        "Hybrid semantic + skill-aware CV/Job matching"
        "</p>",
        unsafe_allow_html=True,
    )

    if not api_online:
        st.warning(
            "⚠️ The FastAPI backend is **not reachable** at "
            f"`{API_BASE}`. Start it with:\n\n"
            "```bash\nuvicorn app.main:app --reload --port 8000\n```\n\n"
            "Then click **Refresh API status** in the sidebar."
        )

    tab1, tab2, tab3 = st.tabs([
        "🎯 Single Match",
        "📊 Batch Matching",
        "ℹ️ Model Info",
    ])

    with tab1:
        tab_single_match(api_online)
    with tab2:
        tab_batch(api_online)
    with tab3:
        tab_model_info()


if __name__ == "__main__":
    main()
