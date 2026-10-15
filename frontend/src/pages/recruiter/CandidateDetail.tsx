import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, animate } from "motion/react";
import {
  ArrowLeft, CheckCircle, XCircle, Star, Clock,
  ThumbsUp, ThumbsDown, Brain, Trophy,
  AlertCircle, BarChart3, Loader2, Sparkles,
  Mail, FileText, Calendar, Radar as RadarIcon, X, Download, ExternalLink,
  MessageSquareQuote,
} from "lucide-react";
import {
  getJobCandidates, getJob, updateApplicationStatus,
  getApplicationCv, getApplicationCvFileUrl, type ApplicationCV,
} from "../../api/platform";
import { useToast } from "../../context/ToastContext";
import { useI18n } from "../../context/I18nContext";
import { localized } from "@/lib/explanation";
import { AbilityRadar } from "@/components/ui/ability-radar";
import type { Application, JobOffer } from "../../types";

/* ── Big animated score ring ───────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    from.current = score;
    const c = animate(start, score, {
      duration: 2, ease: "easeOut",
      onUpdate: (n) => setV(parseFloat(n.toFixed(1))),
    });
    return c.stop;
  }, [score]);

  const R = 64;
  const C = 2 * Math.PI * R;
  const offset = C - (C * Math.min(v, 100)) / 100;

  return (
    <div className="relative w-48 h-48">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#22d3ee" />
            <stop offset="50%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        <motion.circle
          cx="80" cy="80" r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ filter: "blur(8px)", opacity: 0.45 }}
        />
        <motion.circle
          cx="80" cy="80" r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold font-display text-iridescent-soft">
          {v.toFixed(1)}
        </span>
        <span className="text-xs text-white/35 mt-0.5 tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

/* ── Single metric row with always-visible explanation ────────── */
function MetricRow({ label, score, color, explanation }: {
  label: string; score: number; color: string; explanation: string;
}) {
  const { t } = useI18n();
  const fillGradient =
    color === "emerald" ? "linear-gradient(90deg, #22d3ee, #a78bfa)" :
    color === "amber"   ? "linear-gradient(90deg, #a78bfa, #f472b6)" :
                          "linear-gradient(90deg, rgba(244,114,182,0.55), rgba(255,255,255,0.20))";
  const textClass =
    color === "emerald" ? "text-iridescent-soft" :
    color === "amber"   ? "text-white/70" : "text-white/45";

  return (
    <div className="p-5 rounded-2xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.025)" }}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-white font-semibold">{t(label)}</span>
        <span className={`font-bold font-mono text-base ${textClass}`}>{score.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full mb-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: fillGradient }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        />
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{explanation}</p>
    </div>
  );
}

const STATUS_META: Record<string, { icon: React.ReactNode; cls: string; bg: string; border: string; label: string }> = {
  pending:     { icon: <Clock       size={12} />, cls: "text-white/55", bg: "rgba(255,255,255,0.05)",  border: "rgba(255,255,255,0.10)", label: "Pending"     },
  reviewed:    { icon: <Star        size={12} />, cls: "text-white/70", bg: "rgba(255,255,255,0.07)",  border: "rgba(255,255,255,0.12)", label: "Reviewed"    },
  shortlisted: { icon: <CheckCircle size={12} />, cls: "text-iridescent-soft", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.30)", label: "Shortlisted" },
  rejected:    { icon: <XCircle     size={12} />, cls: "text-white/40", bg: "rgba(244,114,182,0.06)",  border: "rgba(244,114,182,0.18)", label: "Rejected"    },
  hired:       { icon: <Trophy      size={12} />, cls: "text-iridescent",      bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.35)",  label: "Hired"       },
};

export default function CandidateDetail() {
  const { jobId, appId } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError, info } = useToast();
  const { t, lang } = useI18n();

  const [app, setApp]   = useState<Application | null>(null);
  const [job, setJob]   = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /* CV viewer */
  const [cvOpen, setCvOpen]       = useState(false);
  const [cvData, setCvData]       = useState<ApplicationCV | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [pdfBusy, setPdfBusy]     = useState(false);
  const [pdfUrl, setPdfUrl]       = useState<string | null>(null);

  useEffect(() => {
    const jid = Number(jobId);
    const aid = Number(appId);
    Promise.all([getJobCandidates(jid), getJob(jid)])
      .then(([apps, j]) => {
        setApp(apps.find((a) => a.id === aid) ?? null);
        setJob(j);
      })
      .finally(() => setLoading(false));
  }, [jobId, appId]);

  const setStatus = async (status: string) => {
    if (!app) return;
    setBusy(true);
    try {
      await updateApplicationStatus(app.id, status);
      setApp({ ...app, status: status as Application["status"] });
      if (status === "hired")      success("Candidate accepted", "Their score and analysis are now visible in their dashboard.");
      else if (status === "rejected") info("Candidate rejected", "Your feedback is now visible in their dashboard.");
      else success("Status updated", `Marked as ${status}.`);
    } catch {
      toastError("Update failed", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const openCv = async () => {
    if (!app) return;
    setCvOpen(true);
    if (cvData) return;
    setCvLoading(true);
    try {
      const data = await getApplicationCv(app.id);
      setCvData(data);
      if (data.has_file && !pdfUrl) {
        try { setPdfUrl(await getApplicationCvFileUrl(app.id)); } catch { /* keep text fallback */ }
      }
    } catch {
      toastError("Couldn't load CV", "This candidate may not have a CV on file.");
      setCvOpen(false);
    } finally {
      setCvLoading(false);
    }
  };

  const openPdf = async () => {
    if (!app) return;
    setPdfBusy(true);
    try {
      const url = await getApplicationCvFileUrl(app.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toastError("Couldn't open PDF", "The original file may be unavailable.");
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Brain size={22} className="text-white/40 animate-pulse" />
        </div>
        <p className="text-white/30 text-sm">{t("Loading candidate…")}</p>
      </div>
    </div>
  );

  if (!app) return (
    <div className="max-w-3xl mx-auto pt-28 px-4 text-center">
      <p className="text-white/40">Candidate not found.</p>
      <button onClick={() => navigate(`/recruiter/jobs/${jobId}/candidates`)} className="mt-4 text-iridescent-soft text-sm">{t("Back to candidates")}</button>
    </div>
  );

  const expl      = app.explanation;
  const L         = expl ? localized(expl, lang) : null;
  const breakdown = L?.metric_breakdown;
  const sm        = expl?.score_math;
  const probes    = expl?.interview_probes ?? [];
  const statusMeta = STATUS_META[app.status];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-20 relative">
      {/* Iridescent atmospheric blobs */}
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-10"   style={{ width: 360, height: 360, opacity: 0.4 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/3 -right-20" style={{ width: 380, height: 380, opacity: 0.35 }} />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10"
      >
        {/* Back */}
        <button
          onClick={() => navigate(`/recruiter/jobs/${jobId}/candidates`)}
          className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white mb-6 transition-colors group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />{t("Back to candidates")}</button>

        {/* Header — candidate identity + status */}
        <div
          className="relative rounded-3xl border border-white/[0.08] p-6 sm:p-8 mb-6 overflow-hidden"
          style={{ background: "var(--panel)" }}
        >
          <div className="blob-violet animate-blob-3 absolute -top-20 -right-20" style={{ width: 280, height: 280, opacity: 0.25 }} />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold font-display shrink-0"
              style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)", color: "#000" }}>
              {app.candidate_name?.[0]?.toUpperCase() || "?"}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-white mb-1 leading-tight">
                {app.candidate_name}
              </h1>
              <div className="flex items-center gap-4 flex-wrap text-xs text-white/40">
                <span className="flex items-center gap-1.5"><Mail size={11} />{app.candidate_email}</span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={11} />
                  Applied {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="text-xs text-white/30 mt-2">
                Applying for <span className="text-white/55 font-semibold">{job?.title}</span>
                {job?.company && <> @ <span className="text-white/55">{job.company}</span></>}
              </p>
            </div>

            {/* Status badge + View CV */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                style={{ background: statusMeta.bg, borderColor: statusMeta.border }}
              >
                <span className={statusMeta.cls}>{statusMeta.icon}</span>
                <span className={statusMeta.cls}>{t(statusMeta.label)}</span>
              </div>
              <button
                onClick={openCv}
                className="btn-iridescent-border flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white/80 hover:text-white transition-colors"
              >
                <FileText size={13} /> {t("View CV")}
              </button>
            </div>
          </div>
        </div>

        {/* AI score panel */}
        {expl ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-3xl border border-white/[0.08] p-6 sm:p-8 mb-6 overflow-hidden relative"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={app.match_score ?? 0} />
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft">{t("AI Analysis")}</p>
                  {L?.recommended_action && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-black"
                      style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}>
                      {t("Recommendation")}: {L.recommended_action}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-display text-white mb-2 leading-tight">
                  {t(expl.overall_label)}
                </h2>
                {/* Why this score — the actual weighted arithmetic */}
                {L?.why_score && (
                  <p className="text-xs text-white/45 font-mono leading-relaxed mb-3">{L.why_score}</p>
                )}
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  {L?.ramp_up && (
                    <span className="text-white/55">{t("Onboarding")}: <span className="text-white/75">{L.ramp_up}</span></span>
                  )}
                  {!!(sm && sm.points_to_next) && (
                    <span className="text-iridescent-soft">
                      +{sm.points_to_next} {t("to")} {t(sm.next_label)}
                    </span>
                  )}
                </div>
                {probes.length > 0 && (
                  <p className="text-xs text-white/45 mt-3">
                    <span className="font-semibold text-white/60">{t("Probe in interview")}:</span> {probes.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          null
        )}

        {/* Ability radar */}
        {(expl || app.match_score != null) && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.10 }}
            className="rounded-3xl border border-white/[0.08] p-6 mb-6 overflow-hidden relative"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <RadarIcon size={14} className="text-iridescent-soft" />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-iridescent-soft">{t("Ability Profile")}</h3>
            </div>
            <p className="text-xs text-white/40 mb-3">
              {t("Strengths and gaps across the role's key competency areas.")}
            </p>
            <AbilityRadar app={app} height={320} />
          </motion.div>
        )}

        {!expl && (
          <div className="rounded-3xl border border-white/[0.06] p-8 mb-6 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
            <Brain size={28} className="text-white/25 mx-auto mb-3" />
            <p className="text-white/45 mb-1 font-semibold">{t("No AI analysis yet")}</p>
            <p className="text-xs text-white/25">Go back to the candidates page and run AI Analysis to score this applicant.</p>
          </div>
        )}

        {/* Why Hire / Concerns side-by-side */}
        {expl && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="grid md:grid-cols-2 gap-4 mb-6"
          >
            {/* Why Hire */}
            <div className="rounded-3xl border border-white/[0.08] p-6"
              style={{
                background: "var(--panel)",
                boxShadow: "inset 0 0 0 1px rgba(34,211,238,0.06)",
              }}>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp size={14} className="text-iridescent-soft" />
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-iridescent-soft">{t("Why Hire")}</h3>
              </div>
              <p className="text-sm text-white/65 leading-relaxed mb-4">{L?.why_hire}</p>
              {L?.strengths && L.strengths.length > 0 && (
                <div className="space-y-2">
                  {L.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle size={12} className="text-iridescent-soft mt-0.5 shrink-0" />
                      <p className="text-xs text-white/50 leading-relaxed">{s}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Concerns */}
            <div className="rounded-3xl border border-white/[0.08] p-6"
              style={{
                background: "var(--panel)",
                boxShadow: "inset 0 0 0 1px rgba(244,114,182,0.06)",
              }}>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsDown size={14} className="text-white/55" />
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">{t("Concerns")}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-4">{L?.why_not_hire}</p>
              {L?.weaknesses && L.weaknesses.length > 0 && (
                <div className="space-y-2">
                  {L.weaknesses.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle size={12} className="text-white/40 mt-0.5 shrink-0" />
                      <p className="text-xs text-white/45 leading-relaxed">{w}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Suggested interview questions */}
        {L?.interview_questions && L.interview_questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="rounded-3xl border border-white/[0.08] p-6 mb-6"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageSquareQuote size={14} className="text-iridescent-soft" />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-iridescent-soft">
                {t("Suggested interview questions")}
              </h3>
            </div>
            <div className="space-y-2.5">
              {L.interview_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-2xl border border-white/[0.06]"
                  style={{ background: "rgba(var(--ink-rgb),0.02)" }}>
                  <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
                    style={{ background: "linear-gradient(135deg,#22d3ee,#a78bfa)" }}>
                    {i + 1}
                  </span>
                  <p className="text-sm text-white/65 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Metric breakdown — always visible, no toggles */}
        {breakdown && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="rounded-3xl border border-white/[0.08] p-6 mb-6"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={14} className="text-iridescent-soft" />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-iridescent-soft">
                {t("Score Breakdown — exactly how this score was computed")}
              </h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.values(breakdown).map((m) => (
                <MetricRow key={m.label} label={m.label} score={m.score} color={m.color} explanation={m.explanation} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Matched + Missing skills */}
        {((app.matched_skills?.length || 0) + (app.missing_skills?.length || 0)) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="grid md:grid-cols-2 gap-4 mb-6"
          >
            {app.matched_skills?.length > 0 && (
              <div className="rounded-3xl border border-white/[0.08] p-6" style={{ background: "var(--panel)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-iridescent-soft mb-3">
                  {t("Matched Skills")} ({app.matched_skills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {app.matched_skills.map((s) => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-lg text-white/75 border border-white/[0.12]"
                      style={{ background: "rgba(34,211,238,0.08)" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {app.missing_skills?.length > 0 && (
              <div className="rounded-3xl border border-white/[0.08] p-6" style={{ background: "var(--panel)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3">
                  {t("Missing Skills")} ({app.missing_skills.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {app.missing_skills.map((s) => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-lg text-white/45 border border-white/[0.08]"
                      style={{ background: "rgba(244,114,182,0.04)" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Cover letter */}
        {app.cover_letter && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.20 }}
            className="rounded-3xl border border-white/[0.08] p-6 mb-6"
            style={{ background: "var(--panel)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3 flex items-center gap-2">
              <FileText size={11} />
              {t("Cover Letter")}
            </p>
            <p className="text-sm text-white/65 leading-relaxed">{app.cover_letter}</p>
          </motion.div>
        )}

        {/* Existing recruiter note */}
        {app.recruiter_notes && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="rounded-3xl border p-5 mb-6"
            style={{ background: "rgba(167,139,250,0.04)", borderColor: "rgba(167,139,250,0.20)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-iridescent-soft mb-2 flex items-center gap-2">
              <Sparkles size={11} />
              {t("Your Note")}
            </p>
            <p className="text-sm text-white/60 italic leading-relaxed">"{app.recruiter_notes}"</p>
          </motion.div>
        )}

        {/* Decision bar */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="rounded-3xl border border-white/[0.08] p-5 flex flex-wrap gap-2"
          style={{ background: "var(--panel)" }}
        >
          <button
            onClick={() => setStatus("hired")}
            disabled={busy}
            className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa)", color: "#000" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {t("Accept")}
          </button>
          <button
            onClick={() => setStatus("shortlisted")}
            disabled={busy}
            className="btn-iridescent-border flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/80 hover:text-white transition-colors disabled:opacity-40"
          >
            <Star size={13} /> {t("Shortlist")}
          </button>
          <button
            onClick={() => setStatus("rejected")}
            disabled={busy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white/50 border border-white/[0.10] hover:bg-white/[0.04] hover:text-white/80 transition-all disabled:opacity-40"
          >
            <XCircle size={13} /> {t("Reject")}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => navigate(`/recruiter/jobs/${jobId}/stats`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white/45 hover:text-white border border-white/[0.06] hover:bg-white/[0.04] transition-all"
          >
            <BarChart3 size={13} /> {t("View Job Statistics")}
          </button>
        </motion.div>
      </motion.div>

      {/* ── CV viewer modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {cvOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCvOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)" }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-white/[0.10] overflow-hidden"
              style={{ background: "var(--panel-2)", backdropFilter: "blur(24px)" }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.20), rgba(167,139,250,0.20))" }}>
                    <FileText size={16} className="text-iridescent-soft" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {cvData?.candidate_name || app.candidate_name}'s CV
                    </p>
                    <p className="text-xs text-white/35 truncate">{cvData?.filename || "Resume"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cvData?.has_file && (
                    <button
                      onClick={openPdf}
                      disabled={pdfBusy}
                      className="btn-iridescent-border flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/80 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      {t("Open PDF")}
                    </button>
                  )}
                  <button
                    onClick={() => setCvOpen(false)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-hidden">
                {cvLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 size={24} className="animate-spin text-iridescent-soft" />
                    <p className="text-sm text-white/35">{t("Loading CV…")}</p>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    title="CV PDF"
                    className="w-full h-[74vh] bg-white"
                  />
                ) : cvData?.has_text ? (
                  <pre className="h-full overflow-y-auto p-6 text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-body">
                    {cvData.cv_text}
                  </pre>
                ) : (
                  <div className="text-center py-16">
                    <FileText size={28} className="text-white/20 mx-auto mb-3" />
                    <p className="text-white/45 font-semibold mb-1">No extracted text</p>
                    <p className="text-xs text-white/30">
                      {cvData?.has_file
                        ? "Use “Open PDF” above to view the original file."
                        : "This candidate has no readable CV on file."}
                    </p>
                  </div>
                )}
              </div>

              {cvData?.has_file && (
                <div className="px-6 py-3 border-t border-white/[0.08] shrink-0 flex items-center gap-2 text-xs text-white/30">
                  <Download size={11} />
                  Original PDF available — use “Open PDF” to view or save it.
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
