import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 60000,
});

export const matchingClient = api;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MatchResult {
  score?: number;
  total_score?: number;
  semantic_score?: number;
  skill_proximity_score?: number;
  tfidf_score?: number;
  url_boost?: number;
  matched_skills: string[];
  missing_skills: string[];
  explanation: string;
  confidence?: number;
  language?: string;
  matching_sections?: Record<string, number>;
  [key: string]: unknown;
}

export interface BatchMatchItem {
  rank: number;
  cv_preview: string;
  score: number;
  explanation: string;
  matched_skills: string[];
  missing_skills: string[];
}

export interface HealthResponse {
  status: string;
  models_loaded: boolean;
  uptime_seconds: number;
}

export interface MetricsResponse {
  total_matches: number;
  avg_score: number;
  model_versions: string[];
}

export interface HistoryRecord {
  id?: number;
  total_score?: number;
  score?: number;
  semantic_score?: number;
  skill_proximity_score?: number;
  tfidf_score?: number;
  explanation?: string;
  matched_skills?: string[] | string;
  missing_skills?: string[] | string;
  timestamp?: string;
  created_at?: string;
  cv_text?: string;
  job_text?: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getScore(r: MatchResult | BatchMatchItem): number {
  if ("total_score" in r && r.total_score != null) return r.total_score as number;
  if ("score" in r && r.score != null) return r.score as number;
  return 0;
}

export function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent Match";
  if (score >= 65) return "Good Match";
  if (score >= 45) return "Partial Match";
  if (score >= 25) return "Weak Match";
  return "Poor Match";
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const matchText = (cv_text: string, job_text: string) =>
  api.post<MatchResult>("/match/text", { cv_text, job_text }).then((r) => r.data);

export const matchPdf = (cvFile: File, job_text: string) => {
  const form = new FormData();
  form.append("cv_pdf", cvFile);
  form.append("job_text", job_text);
  return api
    .post<MatchResult>("/match/pdf", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const matchBatch = (cvs: string[], job_text: string) =>
  api.post<BatchMatchItem[]>("/match/batch", { cvs, job_text }).then((r) => r.data);

export const getHealth = () =>
  api.get<HealthResponse>("/health").then((r) => r.data);

export const getMetrics = () =>
  api.get<MetricsResponse>("/metrics").then((r) => r.data);

export const getHistory = (limit = 30) =>
  api.get<HistoryRecord[]>("/history", { params: { limit } }).then((r) => r.data);
