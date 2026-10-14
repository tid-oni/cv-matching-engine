import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

type Lang = "en" | "fr";

/* ── English → French dictionary ──────────────────────────────────────
   Keys are the English source strings. Missing keys fall back to the
   key itself, so any untranslated string still renders (in English).   */
const FR: Record<string, string> = {
  // ── Navbar ──
  "Dashboard": "Tableau de bord",
  "Find Jobs": "Offres d'emploi",
  "Applications": "Candidatures",
  "My Jobs": "Mes offres",
  "Users": "Utilisateurs",
  "Jobs": "Offres",
  "Statistics": "Statistiques",
  "Monitor": "Supervision",
  "Sign out": "Déconnexion",
  "Light": "Clair",
  "Dark": "Sombre",

  // ── Common ──
  "Welcome back": "Bon retour",
  "Loading…": "Chargement…",
  "Loading your dashboard…": "Chargement de votre tableau de bord…",
  "Loading candidates…": "Chargement des candidats…",
  "Loading candidate…": "Chargement du candidat…",
  "Loading statistics…": "Chargement des statistiques…",
  "Loading your applications…": "Chargement de vos candidatures…",
  "Back": "Retour",
  "Back to jobs": "Retour aux offres",
  "Back to candidates": "Retour aux candidats",
  "Export": "Exporter",
  "Total": "Total",
  "Active": "Actif",
  "Pending": "En attente",
  "Reviewed": "Examinée",
  "Shortlisted": "Présélectionné",
  "Rejected": "Refusée",
  "Hired": "Recruté",
  "Accept": "Accepter",
  "Reject": "Refuser",
  "Shortlist": "Présélectionner",
  "Cancel": "Annuler",
  "Open": "Ouvrir",
  "View": "Voir",
  "Not scored": "Non évalué",
  "applicants": "candidats",
  "applicant": "candidat",
  "active": "actifs",

  // ── Candidate dashboard ──
  "Candidate Dashboard": "Tableau de bord candidat",
  "Your CV is active — browse jobs and track your applications below.":
    "Votre CV est actif — parcourez les offres et suivez vos candidatures ci-dessous.",
  "Upload your CV to get started with AI-powered job matching.":
    "Téléchargez votre CV pour démarrer le matching d'offres par IA.",
  "Your CV": "Votre CV",
  "Total Applied": "Candidatures",
  "Pending Review": "En cours d'examen",
  "Browse Jobs": "Parcourir les offres",
  "Find your next opportunity": "Trouvez votre prochaine opportunité",
  "My Applications": "Mes candidatures",
  "Upload your CV to unlock AI matching and job recommendations.":
    "Téléchargez votre CV pour débloquer le matching IA et les recommandations.",
  "Track all your job applications and their current status.":
    "Suivez toutes vos candidatures et leur statut actuel.",
  "In Progress": "En cours",
  "Accepted": "Accepté",
  "Your Ability Profile": "Votre profil de compétences",
  "Your strengths and gaps across the role's key competency areas.":
    "Vos forces et lacunes sur les domaines de compétences clés du poste.",
  "Score Breakdown": "Détail du score",
  "Your Matching Skills": "Vos compétences correspondantes",
  "Skills to Develop": "Compétences à développer",

  // ── Recruiter dashboard ──
  "Recruiter Dashboard": "Tableau de bord recruteur",
  "Overview of your hiring pipeline": "Vue d'ensemble de votre pipeline de recrutement",
  "Post a Job": "Publier une offre",
  "Active Jobs": "Offres actives",
  "Total Applications": "Total candidatures",
  "Total Job Posts": "Total des offres",
  "Avg. Applicants": "Moyenne candidats",
  "Your Job Posts": "Vos offres",
  "Manage all": "Tout gérer",
  "No jobs posted yet": "Aucune offre publiée",
  "Post your first job": "Publiez votre première offre",
  "Quick Actions": "Actions rapides",
  "Create a new listing": "Créer une nouvelle annonce",
  "Manage Jobs": "Gérer les offres",
  "Edit, toggle, delete": "Modifier, activer, supprimer",
  "Recent Candidates": "Candidats récents",
  "View all candidates": "Voir tous les candidats",

  // ── Recruiter jobs ──
  "Recruiter · My Jobs": "Recruteur · Mes offres",
  "Admin · All Jobs": "Admin · Toutes les offres",
  "My Job Posts": "Mes offres",
  "All Job Posts": "Toutes les offres",
  "Post a job": "Publier une offre",

  // ── Candidates list ──
  "Applicants": "Candidats",
  "Run AI Analysis": "Lancer l'analyse IA",
  "Analyzing…": "Analyse…",
  "Avg Score": "Score moyen",
  "Top Score": "Meilleur score",
  "Shortlisted/Hired": "Présélectionnés/Recrutés",
  "AI Analysis started": "Analyse IA lancée",
  "Scoring complete!": "Analyse terminée !",
  "Scoring failed": "Échec de l'analyse",
  "Please try again.": "Veuillez réessayer.",
  "Score Distribution": "Distribution des scores",
  "No candidates yet": "Aucun candidat",
  "AI Analysis in progress": "Analyse IA en cours",

  // ── Candidate detail ──
  "AI Analysis": "Analyse IA",
  "Ability Profile": "Profil de compétences",
  "Strengths and gaps across the role's key competency areas.":
    "Forces et lacunes sur les domaines de compétences clés du poste.",
  "Why Hire": "Pourquoi recruter",
  "Concerns": "Points de vigilance",
  "Score Breakdown — exactly how this score was computed":
    "Détail du score — comment ce score a été calculé",
  "Matched Skills": "Compétences correspondantes",
  "Missing Skills": "Compétences manquantes",

  // ── Ability radar — axis labels + tooltip ──
  "Languages": "Langages",
  "Frameworks": "Frameworks",
  "Cloud & DevOps": "Cloud & DevOps",
  "Data & AI": "Données & IA",
  "Databases": "Bases de données",
  "Security": "Sécurité",
  "Tools & Practices": "Outils & pratiques",
  "Required Skills": "Compétences requises",
  "Experience Fit": "Adéquation expérience",
  "Skill Breadth": "Étendue des compétences",
  "Keyword Match": "Correspondance mots-clés",
  "Overall Fit": "Adéquation globale",
  "covered": "couvert",
  "Strength": "Force",

  // ── Metric breakdown labels (from the scoring engine) ──
  "Semantic Alignment": "Alignement sémantique",
  "Skill Coverage": "Couverture des compétences",
  "Lexical Relevance": "Pertinence lexicale",
  "Composite Score": "Score composite",

  // ── Overall match labels (from the scoring engine) ──
  "Exceptional Match": "Correspondance exceptionnelle",
  "Strong Match": "Forte correspondance",
  "Moderate Match": "Correspondance modérée",
  "Weak Match": "Faible correspondance",
  "Insufficient Match": "Correspondance insuffisante",
  "Cover Letter": "Lettre de motivation",
  "Your Note": "Votre note",
  "View CV": "Voir le CV",
  "Open PDF": "Ouvrir le PDF",
  "Recommendation": "Recommandation",
  "Onboarding": "Intégration",
  "Probe in interview": "À sonder en entretien",
  "to": "pour",
  "Loading CV…": "Chargement du CV…",
  "View Job Statistics": "Voir les statistiques",
  "No AI analysis yet": "Pas encore d'analyse IA",

  // ── Job stats ──
  "Job Statistics": "Statistiques de l'offre",
  "AI-Scored": "Évalués par IA",
  "Lowest": "Le plus bas",
  "Every Candidate's Breakdown": "Détail de chaque candidat",

  // ── Admin ──
  "Admin Control": "Administration",
  "Admin Dashboard": "Tableau de bord admin",
  "Platform overview and management": "Aperçu et gestion de la plateforme",
  "Live stats": "Stats en direct",
  "Total Users": "Total utilisateurs",
  "Job Offers": "Offres d'emploi",
  "Avg Match Score": "Score moyen",
  "Admin · Users": "Admin · Utilisateurs",
  "User Management": "Gestion des utilisateurs",
  "Admin view": "Vue admin",
  "Candidates": "Candidats",
  "Recruiters": "Recruteurs",
  "Admin · Analytics": "Admin · Analytique",
  "Platform Statistics": "Statistiques de la plateforme",
  "Admin · AI Engine": "Admin · Moteur IA",
  "AI Model Monitor": "Supervision du modèle IA",
  "Model Active": "Modèle actif",

  // ── Job form ──
  "New Job Post": "Nouvelle offre",
  "Edit Job": "Modifier l'offre",
  "Edit job offer": "Modifier l'offre",
  "Update the job details below": "Mettez à jour les détails ci-dessous",
  "Fill in the details to attract the best candidates":
    "Remplissez les détails pour attirer les meilleurs candidats",
};

interface I18nContextType {
  lang: Lang;
  t: (s: string) => string;
  toggleLang: () => void;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  t: (s) => s,
  toggleLang: () => {},
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem("lang");
    return stored === "fr" ? "fr" : "en";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next = prev === "en" ? "fr" : "en";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);

  useEffect(() => { localStorage.setItem("lang", lang); }, [lang]);

  const t = useCallback(
    (s: string) => (lang === "fr" ? (FR[s] ?? s) : s),
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, t, toggleLang, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
