import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Briefcase, Loader2,
  CheckCircle, Send, X, MousePointerClick,
} from "lucide-react";
import { getRecommendedJobs, getJob, applyToJob } from "../../api/platform";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import type { JobOffer } from "../../types";

const jobTypeBadge = (t?: string) => {
  const map: Record<string, string> = {
    "full-time": "bg-white/[0.07] text-white/70",
    "part-time": "bg-white/[0.05] text-white/55",
    "remote": "bg-white/[0.06] text-white/60",
    "contract": "bg-white/[0.04] text-white/50",
  };
  return map[t?.toLowerCase() || ""] || "bg-slate-700/40 text-slate-300";
};

export default function Jobs() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { jobId } = useParams();
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [selected, setSelected] = useState<JobOffer | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [appliedMsg, setAppliedMsg] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [showCL, setShowCL] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecommendedJobs();
      setJobs(data);
      if (jobId) {
        const j = data.find(x => x.id === Number(jobId)) || await getJob(Number(jobId));
        setSelected(j);
      }
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const matchQ = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) ||
      (j.skills_required || []).some(s => s.toLowerCase().includes(q));
    const matchF = !filter || j.job_type?.toLowerCase() === filter;
    return matchQ && matchF;
  });

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    setAppliedMsg("");
    try {
      await applyToJob(selected.id, coverLetter || undefined);
      setAppliedMsg("Application submitted!");
      setShowCL(false);
      setSelected(prev => prev ? { ...prev, already_applied: true } : prev);
      setJobs(prev => prev.map(j => j.id === selected.id ? { ...j, already_applied: true } : j));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAppliedMsg(msg || "Application failed");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 right-1/4" style={{ width: 320, height: 320, opacity: 0.22 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/3 -left-20" style={{ width: 300, height: 300, opacity: 0.18 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative z-10">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
          {t("Find your next opportunity")}
        </p>
        <h1 className="text-3xl font-bold font-display text-white mb-1">{t("Job Offers")}</h1>
        <p className="text-slate-400 text-sm mb-6">
          {user ? "Discover opportunities that fit your profile" : "Browse available positions"}
        </p>
      </motion.div>

      {/* Search */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 transition-all"
            placeholder="Search jobs, skills, companies…" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white/60 text-sm focus:outline-none focus:border-white/20 transition-all">
          <option value="">All types</option>
          {["full-time","part-time","remote","contract"].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* List */}
        <div className="lg:col-span-2 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-white/40" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase size={28} className="text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No jobs found</p>
            </div>
          ) : filtered.map((job, i) => (
            <motion.button key={job.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              onClick={() => setSelected(job)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                selected?.id === job.id
                  ? "border-white/20 bg-white/[0.05]"
                  : "border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03]"
              }`}>
              <div>
                <p className="font-medium text-white text-sm truncate">{job.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{job.company}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {job.location && (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={10} />{job.location}
                    </span>
                  )}
                  {job.job_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobTypeBadge(job.job_type)}`}>
                      {job.job_type}
                    </span>
                  )}
                  {job.already_applied && (
                    <span className="flex items-center gap-1 text-xs text-white/60">
                      <CheckCircle size={10} />Applied
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 sticky top-24">

                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                  <p className="text-slate-400 mt-0.5">{selected.company}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {selected.location && (
                      <span className="flex items-center gap-1 text-sm text-slate-400">
                        <MapPin size={12} />{selected.location}
                      </span>
                    )}
                    {selected.job_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobTypeBadge(selected.job_type)}`}>
                        {selected.job_type}
                      </span>
                    )}
                    {selected.experience_level && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                        {selected.experience_level}
                      </span>
                    )}
                  </div>
                </div>

                {/* Salary */}
                {(selected.salary_min || selected.salary_max) && (
                  <div className="mb-4 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white/70">
                    💰 {selected.salary_min ? `${selected.salary_min.toLocaleString()}€` : ""}
                    {selected.salary_min && selected.salary_max ? " – " : ""}
                    {selected.salary_max ? `${selected.salary_max.toLocaleString()}€` : ""}
                    /year
                  </div>
                )}

                {/* Skills */}
                {selected.skills_required?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Required Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.skills_required.map(s => (
                        <span key={s} className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white/5 text-slate-300 border border-white/5">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="mb-6 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</p>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{selected.description}</p>
                  {selected.requirements && (
                    <>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Requirements</p>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{selected.requirements}</p>
                    </>
                  )}
                </div>

                {/* Apply */}
                {appliedMsg && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`mb-4 px-3 py-2 rounded-xl text-sm flex items-center gap-2 ${
                      appliedMsg.includes("submitted")
                        ? "bg-white/[0.06] border border-white/10 text-white/70"
                        : "bg-white/[0.04] border border-white/[0.08] text-white/40"
                    }`}>
                    <CheckCircle size={14} />
                    {appliedMsg}
                  </motion.div>
                )}

                {showCL && (
                  <div className="mb-4">
                    <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
                      rows={4}
                      placeholder="Write a brief cover letter (optional)..."
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/8 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/20 resize-none transition-all" />
                  </div>
                )}

                <div className="flex gap-3">
                  {selected.already_applied ? (
                    <div className="flex-1 py-2.5 rounded-xl bg-white/[0.08] border border-white/15 text-white/70 text-sm font-medium text-center flex items-center justify-center gap-2">
                      <CheckCircle size={15} /> Applied
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setShowCL(!showCL)}
                        className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white text-sm transition-colors">
                        {showCL ? <X size={15} /> : "Cover letter"}
                      </button>
                      <button onClick={handleApply} disabled={applying}
                        className="flex-1 py-2.5 rounded-xl bg-white hover:bg-white/90 disabled:opacity-50 text-black font-semibold text-sm transition-all flex items-center justify-center gap-2">
                        {applying ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        {applying ? "Applying…" : "Apply now"}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-96 rounded-2xl border border-dashed border-white/5 text-center">
                <MousePointerClick size={26} className="text-slate-700 mb-2" />
                <p className="text-sm text-slate-500">Select a job to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
