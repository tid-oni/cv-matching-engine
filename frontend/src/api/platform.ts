import axios from "axios";
import type { User, JobOffer, Application, CVFile, AdminStats } from "../types";

const api = axios.create({ baseURL: "http://localhost:8000", timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const register = (data: {
  email: string; password: string; full_name: string;
  role: string; company?: string; location?: string;
}) => api.post<{ access_token: string; user: User }>("/auth/register", data).then(r => r.data);

export const login = (email: string, password: string) => {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  return api.post<{ access_token: string; user: User }>("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).then(r => r.data);
};

export const getMe = () => api.get<User>("/auth/me").then(r => r.data);

// Public live-match playground (no auth) — calls the engine directly
export interface LiveMatchResult {
  score?: number;
  total_score?: number;
  semantic_score?: number;
  skill_score?: number;
  skill_proximity_score?: number;
  tfidf_score?: number;
  url_boost?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  explanation?: string;
  [k: string]: unknown;
}

export const matchText = (cv_text: string, job_text: string) =>
  api.post<LiveMatchResult>("/match/text", { cv_text, job_text }).then(r => r.data);

// CV
export const uploadCV = (file: File) => {
  const form = new FormData();
  form.append("cv_pdf", file);
  return api.post<{ cv: CVFile; text_extracted: boolean }>("/cv/upload", form).then(r => r.data);
};

export const getMyCv = () => api.get<CVFile | null>("/cv/mine").then(r => r.data);

// Jobs
export const getJobs = (params?: { search?: string; location?: string; job_type?: string }) =>
  api.get<{ total: number; jobs: JobOffer[] }>("/jobs", { params }).then(r => r.data);

export const getJob = (id: number) => api.get<JobOffer>(`/jobs/${id}`).then(r => r.data);

export const createJob = (data: Partial<JobOffer>) =>
  api.post<JobOffer>("/jobs", data).then(r => r.data);

export const updateJob = (id: number, data: Partial<JobOffer>) =>
  api.put<JobOffer>(`/jobs/${id}`, data).then(r => r.data);

export const deleteJob = (id: number) => api.delete(`/jobs/${id}`);

export const getMyJobs = () =>
  api.get<JobOffer[]>("/recruiter/jobs").then(r => r.data);

// Applications
export const applyToJob = (jobId: number, coverLetter?: string) =>
  api.post<Application>(`/jobs/${jobId}/apply`, { cover_letter: coverLetter }).then(r => r.data);

export const getMyApplications = () =>
  api.get<Application[]>("/candidate/applications").then(r => r.data);

export const getJobCandidates = (jobId: number) =>
  api.get<Application[]>(`/jobs/${jobId}/candidates`).then(r => r.data);

export interface ApplicationCV {
  cv_file_id: number;
  filename: string;
  cv_text: string;
  has_text: boolean;
  has_file: boolean;
  candidate_name?: string;
  uploaded_at?: string;
}

export const getApplicationCv = (appId: number) =>
  api.get<ApplicationCV>(`/applications/${appId}/cv`).then(r => r.data);

/** Fetch the candidate's CV PDF as a blob (authenticated) and return an object URL. */
export const getApplicationCvFileUrl = async (appId: number) => {
  const res = await api.get(`/applications/${appId}/cv/file`, { responseType: "blob" });
  return URL.createObjectURL(res.data as Blob);
};

export const updateApplicationStatus = (appId: number, status: string, notes?: string) =>
  api.put<Application>(`/applications/${appId}/status`, { status, recruiter_notes: notes }).then(r => r.data);

export const getRecommendedJobs = () =>
  api.get<JobOffer[]>("/candidate/recommended-jobs").then(r => r.data);

export const scoreAllCandidates = (jobId: number) =>
  api.post<Application[]>(`/jobs/${jobId}/score-all`).then(r => r.data);

// Admin
export const getAdminStats = () => api.get<AdminStats>("/admin/stats").then(r => r.data);
export const getAdminUsers = () => api.get<User[]>("/admin/users").then(r => r.data);
export const toggleUser = (id: number) => api.put(`/admin/users/${id}/toggle`).then(r => r.data);
export const flagJob = (id: number) => api.put(`/admin/jobs/${id}/flag`).then(r => r.data);

export default api;
