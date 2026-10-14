import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload, Briefcase, FileText, TrendingUp, CheckCircle, AlertCircle,
  ArrowRight, Brain, Sparkles, Clock, XCircle, Star,
  FileCheck, RefreshCw, MapPin, Building2,
} from "lucide-react";
import { uploadCV, getMyCv, getMyApplications, getRecommendedJobs } from "../../api/platform";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useI18n } from "../../context/I18nContext";
import type { CVFile, Application, JobOffer } from "../../types";

const STATUS_COLORS: Record<string, string> = {
  pending:     "rgba(255,255,255,0.4)",
  reviewed:    "rgba(255,255,255,0.55)",
  shortlisted: "rgba(255,255,255,0.7)",
  hired:       "#ffffff",
  rejected:    "rgba(255,255,255,0.25)",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:     <Clock size={12} />,
  reviewed:    <Star size={12} />,
  shortlisted: <CheckCircle size={12} />,
  hired:       <CheckCircle size={12} />,
  rejected:    <XCircle size={12} />,
};

function CVUploadZone({ cv, onUpload, uploading }: {
  cv: CVFile | null;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") onUpload(file);
  };

  return (
    <div
      className={`upload-zone p-8 text-center transition-all duration-300 ${dragOver ? "drag-over" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
      />

      <AnimatePresence mode="wait">
        {uploading ? (
          <motion.div key="uploading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
              <Brain size={24} className="text-white/50 animate-pulse" />
            </div>
            <p className="text-white font-semibold">Parsing your CV…</p>
            <p className="text-white/40 text-sm">AI is extracting skills and experience</p>
            <div className="w-40 h-1 rounded-full bg-white/5 overflow-hidden mt-1">
              <div className="h-full rounded-full shimmer" />
            </div>
          </motion.div>
        ) : cv ? (
          <motion.div key="has-cv"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center">
              <FileCheck size={24} className="text-white/80" />
            </div>
            <div>
              <p className="text-white font-semibold">{cv.filename}</p>
              <p className="text-white/30 text-xs mt-0.5">
                {cv.has_text ? "✓ Parsed successfully" : "⚠ Limited parsing"} ·
                Uploaded {new Date(cv.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40 mt-1">
              <RefreshCw size={11} />
              Click to replace CV
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-3"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: dragOver ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Upload size={24} className="text-white/50" />
            </div>
            <div>
              <p className="text-white font-semibold">Upload your CV</p>
              <p className="text-white/30 text-sm mt-0.5">Drag & drop or click · PDF only</p>
            </div>
            <p className="text-xs text-white/20">AI will parse your skills and experience</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobRecommendCard({ job, idx }: { job: JobOffer; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.22,1,0.36,1] }}
    >
      <Link to={`/jobs/${job.id}`} className="block">
        <div
          className="p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 group"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-white text-sm group-hover:text-white/70 transition-colors truncate">
                  {job.title}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/30">
                <Building2 size={10} />
                <span className="truncate">{job.company}</span>
                {job.location && (
                  <>
                    <span className="text-white/15">·</span>
                    <MapPin size={10} />
                    <span className="truncate">{job.location}</span>
                  </>
                )}
              </div>
            </div>
            <ArrowRight size={14} className="text-white/20 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>

          {job.skills_required?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.skills_required.slice(0, 4).map(s => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-white/30 border border-white/[0.07]">
                  {s}
                </span>
              ))}
              {job.skills_required.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 text-white/20">+{job.skills_required.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function CandidateDashboard() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const { t } = useI18n();
  const [cv, setCv]           = useState<CVFile | null>(null);
  const [apps, setApps]       = useState<Application[]>([]);
  const [jobs, setJobs]       = useState<JobOffer[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoadingData(true);
    try {
      const [cvRes, appsRes, jobsRes] = await Promise.allSettled([
        getMyCv(), getMyApplications(), getRecommendedJobs(),
      ]);
      if (cvRes.status === "fulfilled")   setCv(cvRes.value);
      if (appsRes.status === "fulfilled") setApps(appsRes.value);
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value.slice(0, 6));
    } finally {
      if (!silent) setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadCV(file);
      setCv(result.cv);
      success(
        result.text_extracted ? "CV uploaded & parsed!" : "CV uploaded",
        result.text_extracted
          ? "AI has extracted your skills and experience."
          : "Limited text extraction — try a text-based PDF."
      );
      loadData(true);
    } catch {
      toastError("Upload failed", "Please try again with a valid PDF.");
    } finally {
      setUploading(false);
    }
  };

  const hired       = apps.filter(a => a.status === "hired").length;
  const shortlisted = apps.filter(a => a.status === "shortlisted").length;
  const pending     = apps.filter(a => a.status === "pending" || a.status === "reviewed").length;

  const firstName = user?.full_name.split(" ")[0] || "there";

  if (loadingData) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Brain size={22} className="text-white/40 animate-pulse" />
        </div>
        <p className="text-white/30 text-sm">{t("Loading your dashboard…")}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 relative">
      {/* Atmospheric blobs */}
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-10"   style={{ width: 340, height: 340, opacity: 0.25 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/3 -right-20"  style={{ width: 360, height: 360, opacity: 0.22 }} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}
        className="mb-8 relative z-10"
      >
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">{t("Candidate Dashboard")}</p>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-3xl font-bold font-display text-white">
            {t("Welcome back")}, {firstName}
          </h1>
          <motion.span
            animate={{ rotate: [0, 20, -5, 20, 0] }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-3xl"
          >
            👋
          </motion.span>
        </div>
        <p className="text-white/40 text-sm">
          {cv ? t("Your CV is active — browse jobs and track your applications below.") : t("Upload your CV to get started with AI-powered job matching.")}
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-1 space-y-5">

          {/* CV Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-white/[0.08] overflow-hidden"
            style={{ background: "var(--panel)" }}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-white/40" />
                <span className="text-sm font-semibold text-white">{t("Your CV")}</span>
              </div>
              {cv && (
                <div className="flex items-center gap-1 text-xs text-white/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                  Active
                </div>
              )}
            </div>
            <div className="px-4 pb-5">
              <CVUploadZone cv={cv} onUpload={handleUpload} uploading={uploading} />
            </div>

            {!cv && (
              <div className="px-5 pb-5">
                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-start gap-2">
                  <AlertCircle size={13} className="text-white/40 mt-0.5 shrink-0" />
                  <p className="text-xs text-white/40 leading-relaxed">
                    {t("Upload your CV to unlock AI matching and job recommendations.")}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-3"
          >
            {[
              { label: "Total Applied",  value: apps.length, iridescent: false },
              { label: "Shortlisted",    value: shortlisted,  iridescent: true  },
              { label: "Hired",          value: hired,        iridescent: true  },
              { label: "Pending Review", value: pending,      iridescent: false },
            ].map(({ label, value, iridescent }) => (
              <div
                key={label}
                className="rounded-2xl p-4"
                style={{ background: "var(--panel)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className={`text-2xl font-bold font-display mb-0.5 ${iridescent ? "text-iridescent-soft" : "text-white/75"}`}>
                  {value}
                </div>
                <div className="text-xs text-white/35">{label}</div>
              </div>
            ))}
          </motion.div>

          {/* Quick links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-white/[0.06] p-4 space-y-2"
            style={{ background: "var(--panel)" }}
          >
            <Link to="/jobs"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08]">
                <Briefcase size={16} className="text-white/50" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t("Browse Jobs")}</p>
                <p className="text-xs text-white/30">{t("Find your next opportunity")}</p>
              </div>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </Link>
            <Link to="/applications"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08]">
                <FileText size={16} className="text-white/50" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t("My Applications")}</p>
                <p className="text-xs text-white/30">Track your progress</p>
              </div>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </Link>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Recommended Jobs */}
          {cv && jobs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl border overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08]">
                    <Sparkles size={14} className="text-white/50" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">AI Recommendations</p>
                    <p className="text-xs text-white/30">Based on your CV profile</p>
                  </div>
                </div>
                <Link to="/jobs" className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors font-medium">
                  View all
                  <ArrowRight size={11} />
                </Link>
              </div>
              <div className="px-5 pb-5 grid sm:grid-cols-2 gap-2.5">
                {jobs.map((job, i) => (
                  <JobRecommendCard key={job.id} job={job} idx={i} />
                ))}
              </div>
            </motion.div>
          )}

          {/* No CV prompt */}
          {!cv && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl border p-10 text-center"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", borderStyle: "dashed" }}
            >
              <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Brain size={24} className="text-white/40" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Upload your CV to get started</h3>
              <p className="text-white/30 text-sm max-w-xs mx-auto leading-relaxed">
                Once you upload your CV, our AI will analyze your profile and recommend the best-matching jobs for you.
              </p>
            </motion.div>
          )}

          {/* Recent Applications */}
          {apps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: "var(--panel)" }}
            >
              <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.05]">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-white/30" />
                  <span className="text-sm font-bold text-white">Recent Applications</span>
                </div>
                <Link to="/applications" className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
                  View all ({apps.length})
                  <ArrowRight size={11} />
                </Link>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {apps.slice(0, 5).map((app, i) => {
                  const color = STATUS_COLORS[app.status] || "rgba(255,255,255,0.3)";
                  return (
                    <motion.div
                      key={app.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "rgba(255,255,255,0.05)", color }}
                      >
                        {STATUS_ICONS[app.status]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{app.job_title}</p>
                        <p className="text-xs text-white/25 truncate">{app.job_company}</p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ color, background: "rgba(255,255,255,0.05)" }}
                        >
                          {app.status}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Empty state when no apps */}
          {apps.length === 0 && cv && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-white/[0.06] p-10 text-center"
              style={{ background: "var(--panel)" }}
            >
              <TrendingUp size={32} className="text-white/20 mx-auto mb-3" />
              <h3 className="text-white font-semibold mb-1.5">No applications yet</h3>
              <p className="text-white/30 text-sm mb-5">
                Start applying to jobs to track your progress here.
              </p>
              <Link to="/jobs"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors"
              >
                <Briefcase size={14} />
                Find Jobs
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}