export type UserRole = "candidate" | "recruiter" | "admin";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  company?: string;
  location?: string;
  created_at?: string;
}

export interface JobOffer {
  id: number;
  title: string;
  company: string;
  location?: string;
  job_type?: string;
  experience_level?: string;
  description: string;
  requirements?: string;
  skills_required: string[];
  salary_min?: number;
  salary_max?: number;
  is_active: boolean;
  is_flagged: boolean;
  application_count: number;
  created_at: string;
  recruiter_id: number;
  recruiter_name?: string;
  match_score?: number;
  matched_skills?: string[];
  already_applied?: boolean;
}

export interface MetricDetail {
  score: number;
  label: string;
  color: string;
  explanation: string;
}

export interface ScoreBreakdown {
  semantic_match: MetricDetail;
  skill_coverage: MetricDetail;
  tfidf_lexical: MetricDetail;
  composite: MetricDetail;
}

export interface ImprovementArea {
  title: string;
  items: string[];
  detail: string;
}

export interface CandidateMessage {
  headline: string;
  feedback: string;
  improvement_areas: ImprovementArea[];
  encouragement: string;
}

export interface ScoreMath {
  semantic: number;
  skill: number;
  tfidf: number;
  url_boost: number;
  sem_pts: number;
  skill_pts: number;
  tfidf_pts: number;
  points_to_next: number;
  next_label: string;
  url_absent: boolean;
}

/** A single-language slice of the explanation (recruiter + candidate prose). */
export interface LocalizedExplanation {
  why_hire: string;
  why_not_hire: string;
  strengths: string[];
  weaknesses: string[];
  why_score: string;
  recommended_action: string;
  ramp_up: string;
  interview_probe_line: string;
  interview_questions: string[];
  metric_breakdown: ScoreBreakdown;
  candidate_message: CandidateMessage;
}

export interface AIExplanation {
  overall_score: number;
  overall_label: string;
  why_hire: string;
  why_not_hire: string;
  metric_breakdown: ScoreBreakdown;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  candidate_message?: CandidateMessage;
  // Richer + bilingual additions
  interview_probes?: string[];
  score_math?: ScoreMath;
  why_score?: string;
  recommended_action?: string;
  ramp_up?: string;
  interview_probe_line?: string;
  interview_questions?: string[];
  i18n?: { en: LocalizedExplanation; fr: LocalizedExplanation };
}

export interface Application {
  id: number;
  created_at: string;
  updated_at: string;
  candidate_id: number;
  candidate_name?: string;
  candidate_email?: string;
  job_offer_id: number;
  job_title?: string;
  job_company?: string;
  cv_file_id?: number;
  status: "pending" | "reviewed" | "shortlisted" | "rejected" | "hired";
  match_score?: number;
  matched_skills: string[];
  missing_skills: string[];
  cover_letter?: string;
  recruiter_notes?: string;
  explanation?: AIExplanation;
  score_breakdown?: ScoreBreakdown;
  is_ai_scored?: boolean;
}

export interface CVFile {
  id: number;
  uploaded_at: string;
  owner_id: number;
  filename: string;
  has_text: boolean;
  is_active: boolean;
}

export interface AdminStats {
  total_users: number;
  total_candidates: number;
  total_recruiters: number;
  total_jobs: number;
  active_jobs: number;
  total_applications: number;
  flagged_jobs: number;
  avg_match_score?: number;
}
