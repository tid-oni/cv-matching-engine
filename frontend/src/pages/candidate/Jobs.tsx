import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Briefcase, Loader2,
  CheckCircle, Send, X, MousePointerClick, Banknote,
} from "lucide-react";
import { getRecommendedJobs, getJob, applyToJob } from "../../api/platform";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import type { JobOffer } from "../../types";

const jobTypeBadge = (t?: string) => {
  const map: Record<string, string> = {
    "full-time": "bg-white/[0.07] text-white/70 border border-white/[0.08]",
    "part-time": "bg-white/[0.05] text-white/60 border border-white/[0.07]",
    "remote": "bg-white/[0.06] text-white/65 border border-white/[0.08]",
    "contract": "bg-white/[0.04] text-white/55 border border-white/[0.06]",
  };
  return map[t?.toLowerCase() || ""] || "bg-white/[0.05] text-white/60 border border-white/[0.07]";
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

  const sectionLabel = "text-[10px] font-bold text-white/35 uppercase tracking-[0.16em] mb-2.5";
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 right-1/4" style={{ width: 340, height: 340, opacity: 0.20 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/3 -left-20" style={{ width: 320, height: 320, opacity: 0.16 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative z-10">
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1.5">
          {t("Find your next opportunity")}
        </p>
        <h1 className="text-[34px] leading-none font-bold font-display text-white mb-2">{t("Job Offers")}</h1>
        <p className="text-white/45 text-sm mb-7">
          {user ? t("Discover opportunities that fit your profile") : t("Browse available positions")}
        </p>
      </motion.div>

      {/* Search */}
      <div className="flex gap-3 mb-6 relative z-10">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/25 focus:bg-white/[0.06] transition-all"
            placeholder={t("Search jobs, skills, companies…")} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white/65 text-sm focus:outline-none focus:border-white/25 transition-all cursor-pointer">
          <option value="">{t("All types")}</option>
          {["full-time","part-time","remote","contract"].map(ty => (
            <option key={ty} value={ty}>{ty}</option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 relative z-10">
        {/* List */}
        <div className="lg:col-span-2 space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-white/30" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase size={28} className="text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/45">{t("No jobs found")}</p>
            </div>
          ) : filtered.map((job, i) => {
            const active = selected?.id === job.id;
            return (
              <motion.button key={job.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32, delay: i * 0.035 }}
                onClick={() => setSelected(job)}
                style={active ? { background: "var(--panel)" } : undefined}
                className={`group w-full text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                  active
                    ? "border-white/[0.10] shadow-xl"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10]"
                }`}>
                {active && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r"
                    style={{ background: "linear-gradient(180deg,#22d3ee,#a78bfa)" }} />
                )}
                <p className={`font-semibold text-sm truncate ${active ? "text-white" : "text-white/90"}`}>{job.title}</p>
                <p className="text-xs text-white/45 mt-0.5">{job.company}</p>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {job.location && (
                    <span className="flex items-center gap-1 text-xs text-white/45">
                      <MapPin size={10} />{job.location}
                    </span>
                  )}
                  {job.job_type && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${jobTypeBadge(job.job_type)}`}>
                      {job.job_type}
                    </span>
                  )}
                  {job.already_applied && (
                    <span className="flex items-center gap-1 text-xs text-iridescent-soft font-semibold">
                      <CheckCircle size={10} />{t("Applied")}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key={selected.id}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                style={{ background: "var(--panel)" }}
                className="rounded-3xl border border-white/[0.08] overflow-hidden sticky top-24 shadow-xl">

                {/* Accent band */}
                <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#22d3ee,#a78bfa,#e879f9)" }} />

                <div className="p-7">
                  <div className="mb-6">
                    <h2 className="text-[26px] leading-tight font-bold font-display text-white">{selected.title}</h2>
                    <p className="text-white/50 mt-1 font-medium">{selected.company}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3.5">
                      {selected.location && (
                        <span className="flex items-center gap-1.5 text-sm text-white/50">
                          <MapPin size={13} />{selected.location}
                        </span>
                      )}
                      {selected.job_type && (
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${jobTypeBadge(selected.job_type)}`}>
                          {selected.job_type}
                        </span>
                      )}
                      {selected.experience_level && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/[0.05] text-white/60 border border-white/[0.08] capitalize">
                          {selected.experience_level}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Salary */}
                  {(selected.salary_min || selected.salary_max) && (
                    <div className="mb-6 flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(167,139,250,0.18))" }}>
                        <Banknote size={19} className="text-iridescent-soft" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{t("Salary range")}</p>
                        <p className="text-lg font-bold text-white tabular-nums leading-tight">
                          {selected.salary_min ? fmt(selected.salary_min) : ""}
                          {selected.salary_min && selected.salary_max ? " – " : ""}
                          {selected.salary_max ? fmt(selected.salary_max) : ""}
                          <span className="text-xs font-semibold text-white/45 ml-1.5">{t("MAD / year")}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {selected.skills_required?.length > 0 && (
                    <div className="mb-6">
                      <p className={sectionLabel}>{t("Required Skills")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.skills_required.map(s => (
                          <span key={s} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-white/[0.05] text-white/75 border border-white/[0.08] hover:border-white/20 transition-colors">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <div className="mb-7 max-h-60 overflow-y-auto pr-1">
                    <p className={sectionLabel}>{t("Description")}</p>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{selected.description}</p>
                    {selected.requirements && (
                      <>
                        <p className={`${sectionLabel} mt-5`}>{t("Requirements")}</p>
                        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{selected.requirements}</p>
                      </>
                    )}
                  </div>

                  {/* Apply */}
                  {appliedMsg && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="mb-4 px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-2 bg-white/[0.05] border border-white/[0.10] text-white/75">
                      <CheckCircle size={14} className="text-iridescent-soft" />
                      {t(appliedMsg)}
                    </motion.div>
                  )}

                  {showCL && (
                    <div className="mb-4">
                      <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
                        rows={4}
                        placeholder={t("Write a brief cover letter (optional)…")}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/25 resize-none transition-all" />
                    </div>
                  )}

                  <div className="flex gap-3">
                    {selected.already_applied ? (
                      <div className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/75 text-sm font-semibold text-center flex items-center justify-center gap-2">
                        <CheckCircle size={15} className="text-iridescent-soft" /> {t("Applied")}
                      </div>
                    ) : (
                      <>
                        <button onClick={() => setShowCL(!showCL)}
                          className="px-4 py-3 rounded-xl border border-white/[0.10] text-white/55 hover:text-white hover:bg-white/[0.05] text-sm font-medium transition-all">
                          {showCL ? <X size={15} /> : t("Cover Letter")}
                        </button>
                        <button onClick={handleApply} disabled={applying}
                          className="flex-1 py-3 rounded-xl text-white font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-95"
                          style={{ background: "linear-gradient(90deg,#22d3ee,#a78bfa)", boxShadow: "0 8px 24px rgba(99,102,241,0.28)" }}>
                          {applying ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                          {applying ? t("Applying…") : t("Apply now")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-96 rounded-3xl border border-dashed border-white/[0.10] text-center">
                <MousePointerClick size={26} className="text-white/25 mb-2" />
                <p className="text-sm text-white/45">{t("Select a job to view details")}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
