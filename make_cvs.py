# -*- coding: utf-8 -*-
"""Génère des candidats fictifs : photo (randomuser) + CV PDF (fpdf2).
Profils calibrés du plus fort au plus faible pour un poste Frontend."""
import os, urllib.request
from pathlib import Path
from fpdf import FPDF

HERE = Path(__file__).resolve().parent
OUT = HERE / "demo_cvs"
OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0"}

NAVY = (27, 52, 84); TEAL = (23, 109, 119); GREY = (90, 98, 108); INK = (40, 40, 40)
ARIAL = "C:/Windows/Fonts/arial.ttf"; ARIALBD = "C:/Windows/Fonts/arialbd.ttf"

# (clé, prénom, nom, genre, photo_idx, titre, ville, résumé, skills, [expériences], formation, fit)
CANDIDATES = [
    ("sofia",  "Sofia", "Martinez", "women", 44, "Senior Frontend Engineer", "San Francisco, CA",
     "Senior frontend engineer with 7 years building large-scale React applications. Expert in TypeScript, performance optimization and design systems.",
     ["React", "TypeScript", "Tailwind CSS", "Next.js", "Redux", "JavaScript", "HTML", "CSS",
      "Jest", "REST API", "GraphQL", "CI/CD", "Webpack", "Accessibility"],
     [("Senior Frontend Engineer", "Stripe", "2021 - 2026",
       "Led the migration of the dashboard to React + TypeScript, improving load time by 40%. Built a reusable component library with Tailwind CSS used by 30+ engineers. Set up CI/CD and end-to-end tests with Jest and Playwright."),
      ("Frontend Engineer", "Airbnb", "2019 - 2021",
       "Developed responsive React interfaces consuming REST and GraphQL APIs. Improved accessibility (WCAG) and Core Web Vitals across the booking flow.")],
     "M.Sc. Computer Science, Stanford University", "strong"),

    ("liam",   "Liam", "Anderson", "men", 32, "Frontend Engineer", "Austin, TX",
     "Frontend engineer with 5 years of experience crafting React + TypeScript single-page applications and design systems.",
     ["React", "TypeScript", "JavaScript", "Tailwind CSS", "HTML", "CSS", "Redux", "REST API",
      "Webpack", "Vite", "Jest", "Figma"],
     [("Frontend Engineer", "Shopify", "2021 - 2026",
       "Built merchant-facing React/TypeScript features with Tailwind CSS. Created shared UI components and improved bundle size with Vite. Wrote unit tests with Jest."),
      ("Junior Frontend Developer", "Wayfair", "2019 - 2021",
       "Implemented responsive interfaces in React and JavaScript, integrated REST APIs, collaborated with designers in Figma.")],
     "B.Sc. Software Engineering, UT Austin", "strong"),

    ("aya",    "Aya", "Benali", "women", 68, "Frontend Developer", "Casablanca, MA",
     "Frontend developer (4 years) specialized in React and modern JavaScript, with a strong eye for UI and accessibility.",
     ["React", "JavaScript", "TypeScript", "Tailwind CSS", "HTML", "CSS", "REST API", "Figma", "Git"],
     [("Frontend Developer", "Jumia", "2022 - 2026",
       "Developed e-commerce interfaces with React, JavaScript and Tailwind CSS. Integrated REST APIs and improved mobile responsiveness."),
      ("Web Developer", "Freelance", "2021 - 2022",
       "Built client websites with React and TypeScript, translated Figma designs into clean, accessible components.")],
     "Diplôme d'ingénieur, EMSI Casablanca", "strong"),

    ("noah",   "Noah", "Kim", "men", 51, "Full-Stack Developer", "Seattle, WA",
     "Full-stack developer (4 years), comfortable across React front-ends and Node.js back-ends.",
     ["React", "Node.js", "Express", "JavaScript", "MongoDB", "TypeScript", "HTML", "CSS", "REST API", "Docker"],
     [("Full-Stack Developer", "Expedia", "2022 - 2026",
       "Built React front-ends and Node.js/Express APIs. Used MongoDB and some TypeScript. Containerized services with Docker."),
      ("Web Developer", "Local Agency", "2020 - 2022",
       "Developed JavaScript and React web apps, integrated REST APIs.")],
     "B.Sc. Information Systems, University of Washington", "medium"),

    ("emma",   "Emma", "Rossi", "women", 25, "UI Developer", "Milan, IT",
     "UI developer (3 years) focused on building clean interfaces, mostly with Vue.js and vanilla JavaScript.",
     ["HTML", "CSS", "JavaScript", "Vue.js", "SASS", "Figma", "Bootstrap", "Git", "React"],
     [("UI Developer", "Luxottica", "2022 - 2026",
       "Built marketing interfaces with HTML, CSS, SASS and Vue.js. Collaborated with designers in Figma. Touched React on one internal project."),
      ("Junior Web Developer", "Studio Web", "2021 - 2022",
       "Developed responsive pages with JavaScript and Bootstrap.")],
     "B.A. Digital Design, Politecnico di Milano", "medium"),

    ("omar",   "Omar", "Haddad", "men", 78, "Backend Engineer", "Rabat, MA",
     "Backend engineer (6 years) specialized in Python services, databases and infrastructure. No frontend focus.",
     ["Python", "Django", "FastAPI", "PostgreSQL", "Redis", "Docker", "REST API", "Celery", "Linux"],
     [("Backend Engineer", "Maroc Telecom", "2020 - 2026",
       "Designed Python/Django and FastAPI microservices backed by PostgreSQL and Redis. Built REST APIs, background jobs with Celery, deployed with Docker."),
      ("Software Engineer", "Inwi", "2018 - 2020",
       "Developed backend services in Python, optimized PostgreSQL queries.")],
     "Diplôme d'ingénieur, ENSIAS Rabat", "weak"),

    ("chen",   "Chen", "Wei", "men", 60, "Data Scientist", "Singapore",
     "Data scientist (5 years) working on machine learning, analytics and Python data pipelines.",
     ["Python", "Pandas", "NumPy", "scikit-learn", "TensorFlow", "SQL", "Machine Learning", "Jupyter", "Statistics"],
     [("Data Scientist", "Grab", "2021 - 2026",
       "Built machine learning models with scikit-learn and TensorFlow. Processed data with Pandas and SQL, deployed batch pipelines in Python."),
      ("Data Analyst", "Shopee", "2019 - 2021",
       "Analyzed product data with Python and SQL, created dashboards.")],
     "M.Sc. Data Science, NUS", "weak"),

    ("lucas",  "Lucas", "Silva", "men", 83, "DevOps Engineer", "Lisbon, PT",
     "DevOps / cloud engineer (5 years) focused on infrastructure, automation and CI/CD. No application UI work.",
     ["AWS", "Kubernetes", "Docker", "Terraform", "Bash", "CI/CD", "Linux", "Ansible", "Prometheus"],
     [("DevOps Engineer", "OutSystems", "2021 - 2026",
       "Managed AWS infrastructure with Terraform, orchestrated containers with Kubernetes, built CI/CD pipelines and monitoring with Prometheus."),
      ("System Administrator", "Nos", "2019 - 2021",
       "Automated Linux server provisioning with Bash and Ansible.")],
     "B.Sc. Network Engineering, University of Lisbon", "weak"),
]


def fetch_photo(gender, idx, key):
    p = OUT / f"photo_{key}.jpg"
    if p.exists():
        return p
    url = f"https://randomuser.me/api/portraits/{gender}/{idx}.jpg"
    req = urllib.request.Request(url, headers=UA)
    p.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    return p


class CV(FPDF):
    def header(self): pass
    def footer(self): pass


def build_pdf(c):
    key, first, last, gender, idx, title, city, summary, skills, exps, edu, fit = c
    photo = fetch_photo(gender, idx, key)
    pdf = CV(format="A4"); pdf.set_auto_page_break(auto=True, margin=15); pdf.add_page()
    pdf.add_font("Arial", "", ARIAL); pdf.add_font("Arial", "B", ARIALBD)

    # ── Bandeau d'en-tête ──
    pdf.set_fill_color(*NAVY); pdf.rect(0, 0, 210, 42, "F")
    try:
        pdf.image(str(photo), x=170, y=6, w=30, h=30)
    except Exception:
        pass
    pdf.set_xy(14, 10); pdf.set_text_color(255, 255, 255); pdf.set_font("Arial", "B", 24)
    pdf.cell(150, 11, f"{first} {last}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(14); pdf.set_font("Arial", "B", 12); pdf.set_text_color(120, 200, 210)
    pdf.cell(150, 7, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(14); pdf.set_font("Arial", "", 9); pdf.set_text_color(220, 226, 234)
    email = f"{first.lower()}.{last.lower()}@mail.com"
    pdf.cell(150, 6, f"{email}  |  {city}  |  github.com/{first.lower()}{last.lower()}")

    def section(t):
        pdf.ln(4); pdf.set_text_color(*TEAL); pdf.set_font("Arial", "B", 12)
        pdf.set_x(14); pdf.cell(0, 7, t, new_x="LMARGIN", new_y="NEXT")
        y = pdf.get_y(); pdf.set_draw_color(*TEAL); pdf.set_line_width(0.5)
        pdf.line(14, y, 196, y); pdf.ln(2)

    pdf.set_y(48)
    section("Profil")
    pdf.set_text_color(*INK); pdf.set_font("Arial", "", 10); pdf.set_x(14)
    pdf.multi_cell(182, 5, summary)

    section("Compétences")
    pdf.set_text_color(*INK); pdf.set_font("Arial", "", 10); pdf.set_x(14)
    pdf.multi_cell(182, 5, "  -  ".join(skills))

    section("Expérience professionnelle")
    for role, comp, period, desc in exps:
        pdf.set_x(14); pdf.set_text_color(*NAVY); pdf.set_font("Arial", "B", 10.5)
        pdf.cell(140, 6, f"{role} - {comp}")
        pdf.set_text_color(*GREY); pdf.set_font("Arial", "", 9)
        pdf.cell(42, 6, period, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_x(14); pdf.set_text_color(*INK); pdf.set_font("Arial", "", 9.5)
        pdf.multi_cell(182, 5, desc); pdf.ln(1)

    section("Formation")
    pdf.set_x(14); pdf.set_text_color(*INK); pdf.set_font("Arial", "", 10)
    pdf.multi_cell(182, 5, edu)

    out = OUT / f"cv_{key}.pdf"; pdf.output(str(out))
    return out, email


if __name__ == "__main__":
    for c in CANDIDATES:
        path, email = build_pdf(c)
        print(f"OK  {c[1]} {c[2]:<10} [{c[-1]:<6}] -> {path.name}")
    print(f"\n{len(CANDIDATES)} CV PDFs generated in {OUT}")
