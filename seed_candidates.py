# -*- coding: utf-8 -*-
"""Seed des candidats fictifs : inscription + upload CV PDF + candidature + scoring.
Pré-requis : backend en marche sur :8000, et `python make_cvs.py` déjà exécuté."""
import sys
from pathlib import Path
import requests
from make_cvs import CANDIDATES, OUT

API = "http://localhost:8000"
CAND_PWD = "candidat123"
RECRUITER = {"email": "marcus.chen@techcorp.io", "password": "TechCorp2026!"}
ADMIN = {"email": "admin@matchai.com", "password": "admin123",
         "full_name": "Admin MatchAI", "role": "admin"}


def login(email, password):
    r = requests.post(f"{API}/auth/login", data={"username": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def register(email, password, full_name, role, location=None):
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": password, "full_name": full_name,
        "role": role, "company": None, "location": location})
    if r.status_code == 400:               # déjà inscrit -> login
        return login(email, password)
    r.raise_for_status()
    return r.json()["access_token"]


def main():
    # ── 0) Recruteur + job cible (Frontend) ──
    rec_tok = login(**RECRUITER)
    jobs = requests.get(f"{API}/recruiter/jobs",
                        headers={"Authorization": f"Bearer {rec_tok}"}).json()
    target = next((j for j in jobs if "frontend" in j["title"].lower()), jobs[0])
    job_id = target["id"]
    print(f"Job cible : #{job_id} — {target['title']} ({target['company']})\n")

    # ── 1) Admin ──
    register(**ADMIN)
    print(f"Admin : {ADMIN['email']} / {ADMIN['password']}\n")

    # ── 2) Candidats ──
    rows = []
    for c in CANDIDATES:
        key, first, last = c[0], c[1], c[2]
        city, fit = c[6], c[-1]
        email = f"{first.lower()}.{last.lower()}@mail.com"
        name = f"{first} {last}"
        pdf = OUT / f"cv_{key}.pdf"

        tok = register(email, CAND_PWD, name, "candidate", city)
        h = {"Authorization": f"Bearer {tok}"}

        with open(pdf, "rb") as f:
            up = requests.post(f"{API}/cv/upload", headers=h,
                               files={"cv_pdf": (pdf.name, f, "application/pdf")})
        up.raise_for_status()

        ap = requests.post(f"{API}/jobs/{job_id}/apply", headers=h)
        status = "appliqué" if ap.status_code == 200 else f"déjà postulé"
        print(f"  {name:<16} [{fit:<6}] CV={'ok' if up.json().get('text_extracted') else '??'}  {status}")
        rows.append((name, email, fit))

    # ── 3) Scoring IA (rend les scores visibles + classés) ──
    sc = requests.post(f"{API}/jobs/{job_id}/score-all",
                       headers={"Authorization": f"Bearer {rec_tok}"})
    print(f"\nScoring IA du job #{job_id} : {sc.status_code}")

    # ── 4) Classement obtenu ──
    cands = requests.get(f"{API}/jobs/{job_id}/candidates",
                         headers={"Authorization": f"Bearer {rec_tok}"}).json()
    print("\nClassement dans le dashboard recruteur :")
    for i, a in enumerate(cands, 1):
        sc = a.get("match_score")
        print(f"  {i}. {a['candidate_name']:<16} score = {sc:.0f}" if sc is not None
              else f"  {i}. {a['candidate_name']:<16} score = --")
    return rows, job_id


if __name__ == "__main__":
    main()
