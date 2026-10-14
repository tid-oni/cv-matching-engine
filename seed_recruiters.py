"""
Seed three recruiter accounts (each in a different domain) and post ~7 job
offers from each one. One-shot script — run while the backend is up at :8000.

    python seed_recruiters.py

If an email is already registered the script will log in instead, then post
jobs idempotently (it skips jobs whose exact (title, company) pair already
exists).
"""

from __future__ import annotations

import sys
from typing import Any, Dict, List

import requests

API = "http://localhost:8000"

# ─────────────────────────────────────────────────────────────────────────────
# Recruiters (3) + their domain jobs
# ─────────────────────────────────────────────────────────────────────────────

RECRUITERS: List[Dict[str, Any]] = [
    {
        "email": "marcus.chen@techcorp.io",
        "password": "TechCorp2026!",
        "full_name": "Marcus Chen",
        "company": "TechCorp Solutions",
        "location": "San Francisco, CA",
        "domain": "Software Engineering",
        "jobs": [
            {
                "title": "Senior Frontend Engineer",
                "location": "San Francisco, CA (Hybrid)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Build the next generation of TechCorp's customer dashboard. "
                    "You'll own complex React/TypeScript surfaces, lead frontend "
                    "architecture decisions, mentor mid-level engineers, and "
                    "partner with designers to ship pixel-perfect, accessible UI "
                    "at scale. Expect to work with React 19, TanStack Query, "
                    "Vite, Tailwind, and Storybook on a daily basis."
                ),
                "requirements": (
                    "5+ years of professional frontend experience. Deep React "
                    "and TypeScript knowledge. Proven ability to architect "
                    "large component systems. Comfortable with modern testing "
                    "(Vitest, Playwright). Experience with WebGL or canvas a "
                    "plus."
                ),
                "skills_required": ["React", "TypeScript", "Tailwind CSS", "Vite", "Playwright", "GraphQL"],
                "salary_min": 160000,
                "salary_max": 210000,
            },
            {
                "title": "Backend Engineer — Python / FastAPI",
                "location": "Remote (US)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Design and ship REST and gRPC services that power our SaaS "
                    "platform. You'll work on the auth and billing core: high-"
                    "throughput Python services, PostgreSQL data models, Redis "
                    "caches, and async pipelines. Strong testing and observability "
                    "culture — every endpoint ships with metrics and tracing."
                ),
                "requirements": (
                    "3+ years building production Python services. FastAPI or "
                    "similar (Flask, Django REST) experience. Strong SQL skills. "
                    "Comfortable with Docker and at least one cloud provider."
                ),
                "skills_required": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "AWS"],
                "salary_min": 130000,
                "salary_max": 170000,
            },
            {
                "title": "Full-Stack Engineer (Node + React)",
                "location": "New York, NY",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Own features end-to-end on our partner-facing portal. "
                    "Node/Express backends, React frontends, MongoDB and "
                    "PostgreSQL data, deployed on Vercel and AWS. You'll work "
                    "with product managers to translate ambiguous specs into "
                    "shipping software."
                ),
                "requirements": (
                    "3+ years of full-stack JS experience. Solid React and Node "
                    "fundamentals. Comfortable in both SQL and NoSQL."
                ),
                "skills_required": ["JavaScript", "TypeScript", "Node.js", "Express", "React", "MongoDB", "PostgreSQL"],
                "salary_min": 125000,
                "salary_max": 165000,
            },
            {
                "title": "DevOps / Platform Engineer",
                "location": "Remote (US/EU)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Own the deployment and reliability of TechCorp's "
                    "multi-region Kubernetes platform. You'll write Terraform, "
                    "tune Helm charts, build self-service CI tooling for "
                    "engineering teams, and respond to incidents as part of an "
                    "on-call rotation."
                ),
                "requirements": (
                    "5+ years in DevOps/SRE. Production Kubernetes experience. "
                    "Terraform proficiency. Strong scripting (Bash, Python, Go). "
                    "Comfortable with on-call work."
                ),
                "skills_required": ["Kubernetes", "Terraform", "AWS", "Helm", "GitHub Actions", "Prometheus", "Grafana", "Go"],
                "salary_min": 160000,
                "salary_max": 220000,
            },
            {
                "title": "Mobile Engineer — React Native",
                "location": "Austin, TX (Hybrid)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Build the TechCorp mobile app that ships to 250K+ users. "
                    "React Native codebase with native modules where needed "
                    "(Swift / Kotlin). You'll work on offline sync, push "
                    "notifications, and biometric auth."
                ),
                "requirements": (
                    "3+ years of mobile development. React Native production "
                    "experience. Familiarity with native iOS or Android "
                    "development for module integration."
                ),
                "skills_required": ["React Native", "TypeScript", "Swift", "Kotlin", "Firebase", "Jest"],
                "salary_min": 135000,
                "salary_max": 175000,
            },
            {
                "title": "Staff Software Engineer (Distributed Systems)",
                "location": "Seattle, WA",
                "job_type": "full-time",
                "experience_level": "staff",
                "description": (
                    "Lead the design of TechCorp's next-generation event-"
                    "processing platform — billions of events per day across "
                    "Kafka, Flink, and a sharded Postgres cluster. This is a "
                    "deep technical role with mentorship and architectural "
                    "leadership responsibilities."
                ),
                "requirements": (
                    "8+ years of professional engineering. Track record of "
                    "designing distributed systems at scale. Comfortable in Go "
                    "or Java. Strong opinions on consistency, observability, "
                    "and developer experience."
                ),
                "skills_required": ["Go", "Java", "Kafka", "Flink", "PostgreSQL", "gRPC", "Kubernetes"],
                "salary_min": 220000,
                "salary_max": 290000,
            },
            {
                "title": "Junior Software Engineer (New Grad Welcome)",
                "location": "San Francisco, CA",
                "job_type": "full-time",
                "experience_level": "junior",
                "description": (
                    "Kickstart your career at TechCorp. You'll join a mentor-"
                    "led team building internal tools used by our customer "
                    "success org. Strong onboarding, weekly 1:1s, and a "
                    "curated learning budget."
                ),
                "requirements": (
                    "CS degree or equivalent experience. Fluent in at least "
                    "one general-purpose language (JS/TS, Python, Go, or "
                    "Java). A finished personal project or internship."
                ),
                "skills_required": ["Python", "JavaScript", "Git", "SQL", "REST APIs"],
                "salary_min": 95000,
                "salary_max": 125000,
            },
        ],
    },

    # ─── Recruiter 2: Data Science / AI ────────────────────────────────────
    {
        "email": "priya.shah@datanexus.ai",
        "password": "DataAI2026!",
        "full_name": "Priya Shah",
        "company": "DataNexus AI",
        "location": "London, UK",
        "domain": "Data Science / AI",
        "jobs": [
            {
                "title": "Senior Data Scientist",
                "location": "London, UK (Hybrid)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Drive end-to-end ML projects from problem framing through "
                    "production deployment. You'll work with product to identify "
                    "high-leverage opportunities, design experiments, build "
                    "models (classical ML and deep learning), and partner with "
                    "ML engineering to ship."
                ),
                "requirements": (
                    "5+ years of applied ML. Strong Python (pandas, NumPy, "
                    "scikit-learn). Production deployment experience. PhD or "
                    "MSc in a quantitative field preferred."
                ),
                "skills_required": ["Python", "scikit-learn", "PyTorch", "SQL", "Pandas", "MLflow", "Statistics"],
                "salary_min": 95000,
                "salary_max": 130000,
            },
            {
                "title": "Machine Learning Engineer (MLOps)",
                "location": "Remote (Europe)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Productionise the models our data scientists build. You'll "
                    "own the training and serving infrastructure: feature stores, "
                    "model registries, batch and real-time inference pipelines, "
                    "drift monitoring, and rollback tooling."
                ),
                "requirements": (
                    "3+ years building ML infra in production. Strong Python. "
                    "Hands-on with at least one ML serving stack (KFServing, "
                    "BentoML, TorchServe, Triton, or Vertex)."
                ),
                "skills_required": ["Python", "PyTorch", "Docker", "Kubernetes", "MLflow", "BentoML", "AWS SageMaker"],
                "salary_min": 85000,
                "salary_max": 120000,
            },
            {
                "title": "Senior Data Engineer",
                "location": "London, UK",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Build and operate the data platform that powers every "
                    "team at DataNexus AI. Ingestion (Kafka, CDC), warehousing "
                    "(BigQuery and Snowflake), transformation (dbt + Airflow), "
                    "and self-serve analytics."
                ),
                "requirements": (
                    "5+ years of data engineering. Expert SQL. Production "
                    "Airflow or Prefect experience. Strong Python or Scala."
                ),
                "skills_required": ["Python", "SQL", "Airflow", "dbt", "Spark", "Kafka", "Snowflake", "BigQuery"],
                "salary_min": 90000,
                "salary_max": 125000,
            },
            {
                "title": "AI Research Engineer — LLMs",
                "location": "Remote (Global)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Push the frontier of applied LLM research at DataNexus. "
                    "Fine-tune open-weight models, design retrieval architectures "
                    "for our customers' enterprise data, and publish technical "
                    "deep-dives. We invest heavily in compute — you'll have "
                    "real budget for H100 training runs."
                ),
                "requirements": (
                    "PhD in ML/NLP or equivalent industry experience. Hands-on "
                    "with Transformers, LoRA/QLoRA, RAG. Published research "
                    "preferred but not required."
                ),
                "skills_required": ["Python", "PyTorch", "Transformers", "Hugging Face", "LangChain", "CUDA", "Distributed Training"],
                "salary_min": 130000,
                "salary_max": 200000,
            },
            {
                "title": "Analytics Engineer",
                "location": "London, UK (Hybrid)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Translate raw warehouse data into trustworthy models that "
                    "the rest of the company can rely on. You'll own the dbt "
                    "graph, partner with BI, and define our metrics layer."
                ),
                "requirements": (
                    "3+ years in analytics engineering or data analysis. "
                    "Expert SQL and dbt. Strong communication with non-technical "
                    "stakeholders."
                ),
                "skills_required": ["SQL", "dbt", "Snowflake", "Looker", "Python", "Git"],
                "salary_min": 70000,
                "salary_max": 95000,
            },
            {
                "title": "Senior NLP Engineer",
                "location": "Remote (Europe)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Ship NLP features into our enterprise products: semantic "
                    "search, document classification, summarisation, and "
                    "entity extraction. You'll work across both fine-tuned "
                    "small models and frontier LLMs depending on the task."
                ),
                "requirements": (
                    "4+ years of applied NLP. Production experience with "
                    "Transformers and Hugging Face. Strong evaluation discipline."
                ),
                "skills_required": ["Python", "PyTorch", "Hugging Face", "spaCy", "BERT", "Sentence Transformers", "FAISS"],
                "salary_min": 100000,
                "salary_max": 140000,
            },
            {
                "title": "Computer Vision Engineer",
                "location": "Cambridge, UK",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Build vision models that ship to the edge for our "
                    "industrial inspection customers. Detection, segmentation, "
                    "OCR, and on-device optimisation (ONNX, TensorRT)."
                ),
                "requirements": (
                    "3+ years in applied CV. Strong PyTorch and OpenCV. "
                    "Familiarity with model compression and quantisation."
                ),
                "skills_required": ["Python", "PyTorch", "OpenCV", "ONNX", "TensorRT", "YOLO", "Detectron2"],
                "salary_min": 80000,
                "salary_max": 115000,
            },
        ],
    },

    # ─── Recruiter 3: Cybersecurity & Cloud ────────────────────────────────
    {
        "email": "leila.benali@securecloud.com",
        "password": "SecureCloud2026!",
        "full_name": "Leila Benali",
        "company": "SecureCloud Systems",
        "location": "Casablanca, Morocco",
        "domain": "Cybersecurity & Cloud",
        "jobs": [
            {
                "title": "Senior Cloud Security Engineer",
                "location": "Remote (EMEA)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Harden the multi-cloud infrastructure that our Fortune 500 "
                    "customers depend on. You'll design IAM boundaries, write "
                    "automated guardrails (Terraform Sentinel, OPA), respond to "
                    "security events, and lead post-incident reviews."
                ),
                "requirements": (
                    "5+ years in cloud security. Deep AWS and at least one of "
                    "Azure or GCP. Hands-on with IAM, KMS, VPC, and security "
                    "tooling. Familiarity with compliance frameworks (SOC 2, "
                    "ISO 27001)."
                ),
                "skills_required": ["AWS", "Azure", "Terraform", "IAM", "OPA", "Python", "SIEM", "SOC 2"],
                "salary_min": 90000,
                "salary_max": 140000,
            },
            {
                "title": "DevSecOps Engineer",
                "location": "Casablanca, Morocco (Hybrid)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Bring security into every step of our customers' CI/CD "
                    "pipelines. Static and dynamic scanning, SBOM generation, "
                    "secret detection, container image hardening, and "
                    "production policy enforcement."
                ),
                "requirements": (
                    "3+ years in DevOps with a security focus. Comfortable "
                    "with GitHub Actions, GitLab CI, or Jenkins. Familiarity "
                    "with SAST/DAST tools (Snyk, Semgrep, Trivy)."
                ),
                "skills_required": ["GitHub Actions", "Docker", "Kubernetes", "Snyk", "Semgrep", "Trivy", "Python", "Bash"],
                "salary_min": 60000,
                "salary_max": 95000,
            },
            {
                "title": "Penetration Tester (Offensive Security)",
                "location": "Remote (Global)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Lead red-team engagements for our enterprise customers. "
                    "Web, cloud, and internal network pen-tests. You'll write "
                    "high-quality reports, present findings to executive "
                    "stakeholders, and contribute to our internal tooling."
                ),
                "requirements": (
                    "5+ years in offensive security. OSCP, OSCE, or "
                    "equivalent. Strong scripting (Python, PowerShell). "
                    "Published research, CVEs, or CTF placements appreciated."
                ),
                "skills_required": ["Burp Suite", "Metasploit", "Nmap", "Python", "PowerShell", "OWASP", "Active Directory"],
                "salary_min": 110000,
                "salary_max": 160000,
            },
            {
                "title": "SOC Analyst — Tier 2",
                "location": "Casablanca, Morocco",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Investigate and triage security alerts for our managed "
                    "SOC service. You'll work in our SIEM (Splunk + Elastic) "
                    "and EDR stack, escalate to incident response, and tune "
                    "detection rules over time."
                ),
                "requirements": (
                    "3+ years in a SOC environment. Experience with SIEM "
                    "tuning. Familiarity with MITRE ATT&CK. Strong written "
                    "communication for incident reports."
                ),
                "skills_required": ["Splunk", "Elastic", "CrowdStrike", "MITRE ATT&CK", "Python", "Wireshark"],
                "salary_min": 50000,
                "salary_max": 80000,
            },
            {
                "title": "Cloud Solutions Architect (AWS)",
                "location": "Remote (EMEA)",
                "job_type": "full-time",
                "experience_level": "senior",
                "description": (
                    "Design and deliver secure, scalable AWS architectures for "
                    "our enterprise migration customers. You'll lead workshops, "
                    "write reference architectures, and embed with customer "
                    "engineering teams to drive complex migrations to "
                    "completion."
                ),
                "requirements": (
                    "6+ years in cloud architecture. AWS Solutions Architect "
                    "Professional certification. Strong communication with "
                    "C-suite and engineering audiences."
                ),
                "skills_required": ["AWS", "Terraform", "VPC", "EKS", "Lambda", "DynamoDB", "CloudFormation"],
                "salary_min": 110000,
                "salary_max": 160000,
            },
            {
                "title": "Identity & Access Management (IAM) Engineer",
                "location": "Remote (Global)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Design and implement IAM solutions for our customers' "
                    "enterprise environments. Okta, Azure AD, and Auth0 "
                    "integrations. SSO, SAML, OIDC, lifecycle automation, "
                    "least-privilege modelling."
                ),
                "requirements": (
                    "3+ years in IAM. Strong Okta or Azure AD experience. "
                    "Familiarity with SCIM and modern identity protocols."
                ),
                "skills_required": ["Okta", "Azure AD", "SAML", "OIDC", "SCIM", "Auth0", "Python"],
                "salary_min": 80000,
                "salary_max": 120000,
            },
            {
                "title": "Application Security Engineer",
                "location": "Remote (EMEA)",
                "job_type": "full-time",
                "experience_level": "mid",
                "description": (
                    "Partner with our customers' product engineering teams to "
                    "embed security from design through deployment. Threat "
                    "modelling, secure code review, and AppSec training "
                    "programs."
                ),
                "requirements": (
                    "3+ years in AppSec. Strong code review across multiple "
                    "languages. Familiarity with OWASP Top 10 and SSDLC "
                    "frameworks."
                ),
                "skills_required": ["OWASP", "Burp Suite", "Snyk", "Semgrep", "Python", "JavaScript", "Threat Modeling"],
                "salary_min": 85000,
                "salary_max": 125000,
            },
        ],
    },
]


def register_or_login(r: Dict[str, Any]) -> str:
    """Register a recruiter; if email exists, log in instead. Returns access token."""
    payload = {
        "email":     r["email"],
        "password":  r["password"],
        "full_name": r["full_name"],
        "role":      "recruiter",
        "company":   r["company"],
        "location":  r["location"],
    }
    resp = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    if resp.status_code == 200:
        return resp.json()["access_token"]
    if resp.status_code == 400 and "already registered" in resp.text.lower():
        form = {"username": r["email"], "password": r["password"]}
        resp = requests.post(f"{API}/auth/login", data=form, timeout=30)
        resp.raise_for_status()
        return resp.json()["access_token"]
    resp.raise_for_status()
    raise RuntimeError("unreachable")


def existing_titles(token: str) -> set:
    """Return the set of (title, company) the recruiter already owns."""
    resp = requests.get(f"{API}/recruiter/jobs", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    resp.raise_for_status()
    return {(j["title"], j["company"]) for j in resp.json()}


def create_job(token: str, company: str, job: Dict[str, Any]) -> Dict[str, Any]:
    payload = {**job, "company": company}
    resp = requests.post(f"{API}/jobs", json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    print("Seeding 3 recruiter accounts + their job offers...\n")
    total_jobs = 0
    summary: List[str] = []

    for r in RECRUITERS:
        print(f"=== {r['company']} ({r['domain']}) ===")
        try:
            token = register_or_login(r)
        except Exception as e:
            print(f"  ! registration/login failed: {e}", file=sys.stderr)
            continue

        already = existing_titles(token)
        created = 0
        skipped = 0
        for job in r["jobs"]:
            if (job["title"], r["company"]) in already:
                skipped += 1
                continue
            try:
                create_job(token, r["company"], job)
                created += 1
            except Exception as e:
                print(f"  ! failed to create '{job['title']}': {e}", file=sys.stderr)

        total_jobs += created
        summary.append(
            f"  {r['company']:<22} {r['email']:<35}  pwd: {r['password']:<20}"
            f"  jobs: {created} new, {skipped} already existed"
        )
        print(f"  {created} new jobs, {skipped} already existed\n")

    print("\n" + "=" * 90)
    print("SEED COMPLETE")
    print("=" * 90)
    for line in summary:
        print(line)
    print(f"\nTotal new job offers created: {total_jobs}")


if __name__ == "__main__":
    main()
