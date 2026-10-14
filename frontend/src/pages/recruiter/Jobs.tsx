import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Briefcase, Plus, Edit2, Trash2, Users, Eye, EyeOff,
  Loader2, AlertTriangle, Search, ChevronRight,
} from "lucide-react";
import { getMyJobs, deleteJob, updateJob } from "../../api/platform";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import type { JobOffer } from "../../types";

const jobTypeCls: Record<string, string> = {
  "full-time": "bg-white/[0.07] text-white/70 border-white/10",
  "part-time": "bg-white/[0.05] text-white/55 border-white/8",
  "remote": "bg-white/[0.06] text-white/60 border-white/8",
  "contract": "bg-white/[0.04] text-white/50 border-white/6",
  "internship": "bg-white/[0.05] text-white/55 border-white/8",
};

export default function RecruiterJobs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    getMyJobs().then(setJobs).finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.company.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number) => {
    setActionLoading(id);
    try {
      await deleteJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
      setConfirmDelete(null);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (job: JobOffer) => {
    setActionLoading(job.id);
    try {
      const updated = await updateJob(job.id, { is_active: !job.is_active });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_active: updated.is_active } : j));
    } finally {
      setActionLoading(null);
    }
  };

  const isAdmin = user?.role === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 right-1/4" style={{ width: 320, height: 320, opacity: 0.22 }} />
      <div className="blob-violet  animate-blob-2 absolute bottom-0 -left-20" style={{ width: 300, height: 300, opacity: 0.20 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
              {isAdmin ? t("Admin · All Jobs") : t("Recruiter · My Jobs")}
            </p>
            <h1 className="text-3xl font-bold font-display text-white mb-1">
              {isAdmin ? t("All Job Posts") : t("My Job Posts")}
            </h1>
            <p className="text-white/40 text-sm">
              <span className="text-iridescent-soft font-semibold">{jobs.length}</span> job{jobs.length !== 1 ? "s" : ""} ·{" "}
              <span className="text-iridescent-soft font-semibold">{jobs.filter(j => j.is_active).length}</span> {t("active")}
            </p>
          </div>
          {!isAdmin && (
            <Link
              to="/recruiter/jobs/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}
            >
              <Plus size={15} /> {t("Post a job")}
            </Link>
          )}
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative mb-6"
      >
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 transition-all"
          placeholder="Search jobs…"
        />
      </motion.div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
            <Briefcase size={28} className="text-white/25" />
          </div>
          <p className="text-white/40 font-medium mb-1">
            {search ? "No jobs match your search" : "No jobs posted yet"}
          </p>
          {!search && !isAdmin && (
            <Link
              to="/recruiter/jobs/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 text-sm hover:bg-white/[0.1] transition-all"
            >
              <Plus size={14} /> Post your first job
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-2xl border p-5 transition-all ${
                job.is_active
                  ? "border-white/8 bg-white/[0.02]"
                  : "border-white/4 bg-white/[0.01] opacity-60"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-white">{job.title}</h3>
                    {job.is_flagged && (
                      <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-white/[0.08] text-white/50 border border-white/10">
                        <AlertTriangle size={10} /> Flagged
                      </span>
                    )}
                    {!job.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-white/[0.04] text-white/30 border border-white/5">
                        Closed
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-white/35 mb-2">{job.company}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    {job.job_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${jobTypeCls[job.job_type] || "bg-white/[0.04] text-white/40 border-white/5"}`}>
                        {job.job_type}
                      </span>
                    )}
                    {job.experience_level && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40 border border-white/5">
                        {job.experience_level}
                      </span>
                    )}
                    {job.location && (
                      <span className="text-xs text-white/30">{job.location}</span>
                    )}
                  </div>

                  {job.skills_required?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.skills_required.slice(0, 5).map(s => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-white/55 border border-white/8">
                          {s}
                        </span>
                      ))}
                      {job.skills_required.length > 5 && (
                        <span className="text-xs text-white/30">+{job.skills_required.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats + actions */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-sm text-white/40">
                    <Users size={13} className="text-white/40" />
                    <span className="font-semibold text-white">{job.application_count}</span>
                    <span className="text-xs text-white/30">applicant{job.application_count !== 1 ? "s" : ""}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/recruiter/jobs/${job.id}/candidates`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/60 border border-white/10 hover:bg-white/[0.1] hover:text-white transition-all"
                    >
                      <Users size={12} /> Candidates <ChevronRight size={11} />
                    </Link>

                    {!isAdmin && (
                      <>
                        <button
                          onClick={() => handleToggle(job)}
                          disabled={actionLoading === job.id}
                          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                          title={job.is_active ? "Close job" : "Reopen job"}
                        >
                          {actionLoading === job.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : job.is_active ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                        <Link
                          to={`/recruiter/jobs/${job.id}/edit`}
                          className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </Link>
                        <button
                          onClick={() => setConfirmDelete(job.id)}
                          className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  <p className="text-xs text-white/20">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-white/10 p-6 w-full max-w-sm mx-4"
              style={{ background: "#0a0a0a" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4">
                <Trash2 size={20} className="text-white/50" />
              </div>
              <h3 className="text-white font-semibold mb-1">Delete this job?</h3>
              <p className="text-white/40 text-sm mb-5">
                This will permanently remove the job offer and all its applications. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={actionLoading === confirmDelete}
                  className="flex-1 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 text-white/70 font-medium text-sm transition-all flex items-center justify-center gap-2 border border-white/10"
                >
                  {actionLoading === confirmDelete ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}