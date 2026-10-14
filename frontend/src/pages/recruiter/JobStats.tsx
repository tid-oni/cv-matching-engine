import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft, BarChart3, Brain, Users, Trophy, Star,
  CheckCircle, XCircle, Clock, TrendingUp, ArrowRight, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { getJobCandidates, getJob } from "../../api/platform";
import { useI18n } from "../../context/I18nContext";
import { localized } from "@/lib/explanation";
import type { Application, JobOffer } from "../../types";

const STATUS_META: Record<string, { icon: React.ReactNode; cls: string; bg: string; label: string }> = {
  pending:     { icon: <Clock       size={10} />, cls: "text-white/55", bg: "rgba(255,255,255,0.05)", label: "Pending"     },
  reviewed:    { icon: <Star        size={10} />, cls: "text-white/70", bg: "rgba(255,255,255,0.07)", label: "Reviewed"    },
  shortlisted: { icon: <CheckCircle size={10} />, cls: "text-iridescent-soft", bg: "rgba(167,139,250,0.10)", label: "Shortlisted" },
  rejected:    { icon: <XCircle     size={10} />, cls: "text-white/40", bg: "rgba(244,114,182,0.06)", label: "Rejected"    },
  hired:       { icon: <Trophy      size={10} />, cls: "text-iridescent",      bg: "rgba(34,211,238,0.10)", label: "Hired"       },
};

function MiniBar({ score, color }: { score: number; color: string }) {
  const fillGradient =
    color === "emerald" ? "linear-gradient(90deg, #22d3ee, #a78bfa)" :
    color === "amber"   ? "linear-gradient(90deg, #a78bfa, #f472b6)" :
                          "linear-gradient(90deg, rgba(244,114,182,0.55), rgba(255,255,255,0.20))";
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: fillGradient }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(score, 100)}%` }}
        transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
      />
    </div>
  );
}

export default function JobStats() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [apps, setApps]   = useState<Application[]>([]);
  const [job, setJob]     = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(jobId);
    Promise.all([getJobCandidates(id), getJob(id)])
      .then(([a, j]) => {
        // Sort scored first by score desc, then unscored
        const scored   = a.filter((x) => x.match_score != null).sort((x, y) => (y.match_score || 0) - (x.match_score || 0));
        const unscored = a.filter((x) => x.match_score == null);
        setApps([...scored, ...unscored]);
        setJob(j);
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  const scored   = apps.filter((a) => a.match_score != null);
  const avgScore = scored.length ? scored.reduce((s, a) => s + (a.match_score || 0), 0) / scored.length : 0;
  const topScore = scored.length ? Math.max(...scored.map((a) => a.match_score || 0)) : 0;
  const lowScore = scored.length ? Math.min(...scored.map((a) => a.match_score || 0)) : 0;

  const distData = [
    { r: "0–40",  c: scored.filter((a) => (a.match_score || 0) < 40).length, fill: "rgba(244,114,182,0.55)" },
    { r: "40–55", c: scored.filter((a) => (a.match_score || 0) >= 40 && (a.match_score || 0) < 55).length, fill: "rgba(244,114,182,0.75)" },
    { r: "55–70", c: scored.filter((a) => (a.match_score || 0) >= 55 && (a.match_score || 0) < 70).length, fill: "rgba(167,139,250,0.75)" },
    { r: "70–85", c: scored.filter((a) => (a.match_score || 0) >= 70 && (a.match_score || 0) < 85).length, fill: "rgba(34,211,238,0.75)" },
    { r: "85+",   c: scored.filter((a) => (a.match_score || 0) >= 85).length, fill: "rgba(34,211,238,0.95)" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Brain size={22} className="text-white/40 animate-pulse" />
        </div>
        <p className="text-white/30 text-sm">{t("Loading statistics…")}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-20 relative">
      {/* Atmospheric blobs */}
      <div className="blob-cyan    animate-blob-1 absolute -top-10 left-1/4"  style={{ width: 380, height: 380, opacity: 0.35 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/2 -right-20" style={{ width: 360, height: 360, opacity: 0.30 }} />
      <div className="blob-violet  animate-blob-3 absolute bottom-0 left-0"   style={{ width: 320, height: 320, opacity: 0.25 }} />

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

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-2">{t("Job Statistics")}</p>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-white mb-1 leading-tight">
            {job?.title || t("Statistics")}
          </h1>
          <p className="text-white/30 text-sm">
            {job?.company}{job?.location && ` · ${job.location}`} · {apps.length} applicant{apps.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Aggregate KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Applicants",  v: apps.length },
            { label: "AI-Scored",    v: scored.length },
            { label: "Avg Score",    v: scored.length ? `${avgScore.toFixed(1)}%` : "—", iridescent: true },
            { label: "Top Score",    v: scored.length ? `${topScore.toFixed(1)}%` : "—", iridescent: true },
            { label: "Lowest",       v: scored.length ? `${lowScore.toFixed(1)}%` : "—" },
          ].map(({ label, v, iridescent }) => (
            <div key={label}
              className="rounded-2xl p-4 border border-white/[0.08]"
              style={{ background: "var(--panel)" }}
            >
              <div className={`text-2xl font-bold font-display mb-0.5 ${iridescent ? "text-iridescent-soft" : "text-white"}`}>
                {v}
              </div>
              <div className="text-xs text-white/35">{t(label)}</div>
            </div>
          ))}
        </div>

        {/* Distribution chart */}
        {scored.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.10 }}
            className="rounded-3xl border border-white/[0.08] p-6 mb-8"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={14} className="text-iridescent-soft" />
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-iridescent-soft">{t("Score Distribution")}</h3>
              <span className="text-xs text-white/30">({scored.length} scored)</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={distData} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="r" tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.20)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--panel-2)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}
                  itemStyle={{ color: "#fff", fontSize: 12 }}
                />
                <Bar dataKey="c" radius={[4, 4, 0, 0]}>
                  {distData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Per-candidate vertical breakdown — no dropdowns, everything visible */}
        <div className="mb-4 flex items-center gap-2">
          <Users size={14} className="text-iridescent-soft" />
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-iridescent-soft">{t("Every Candidate's Breakdown")}</h3>
        </div>

        {apps.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.06] p-12 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
            <Users size={28} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 font-semibold mb-1">No applicants yet</p>
            <p className="text-xs text-white/25">Statistics will populate once candidates apply.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((app, idx) => {
              const statusMeta = STATUS_META[app.status];
              const expl       = app.explanation;
              const L          = expl ? localized(expl, lang) : null;
              const breakdown  = L?.metric_breakdown;
              const hasScore   = app.match_score != null;

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.4 }}
                  className="rounded-2xl border border-white/[0.06] p-5"
                  style={{ background: "var(--panel)" }}
                >
                  {/* Top row: rank + identity + status + score */}
                  <div className="flex items-center gap-4 flex-wrap mb-4">
                    {/* Rank badge */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: idx === 0 ? "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" : "rgba(255,255,255,0.05)",
                        color: idx === 0 ? "#000" : "rgba(255,255,255,0.55)",
                        border: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {idx === 0 ? <Trophy size={12} /> : idx + 1}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-black shrink-0"
                      style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.85), rgba(167,139,250,0.85))" }}>
                      {app.candidate_name?.[0]?.toUpperCase() || "?"}
                    </div>

                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{app.candidate_name}</p>
                      <p className="text-xs text-white/30 truncate">{app.candidate_email}</p>
                    </div>

                    {/* Status */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-white/[0.10]"
                      style={{ background: statusMeta.bg }}>
                      <span className={statusMeta.cls}>{statusMeta.icon}</span>
                      <span className={statusMeta.cls}>{t(statusMeta.label)}</span>
                    </div>

                    {/* Composite score */}
                    {hasScore ? (
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-bold font-display text-iridescent-soft leading-none">
                          {app.match_score!.toFixed(1)}
                        </div>
                        <div className="text-[10px] text-white/25 mt-0.5">/ 100</div>
                      </div>
                    ) : (
                      <span className="text-xs italic text-white/30 shrink-0">Not scored</span>
                    )}

                    {/* Open detail */}
                    <Link
                      to={`/recruiter/jobs/${jobId}/candidates/${app.id}`}
                      className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors shrink-0"
                    >
                      {t("Open")} <ArrowRight size={11} />
                    </Link>
                  </div>

                  {/* Headline label */}
                  {expl && (
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-iridescent-soft mb-3">
                      <Sparkles size={9} className="inline mr-1 -mt-0.5" />
                      {t(expl.overall_label)}
                    </p>
                  )}

                  {/* Metric breakdown — 4 metrics inline, no dropdown */}
                  {breakdown && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {Object.values(breakdown).map((m) => (
                        <div key={m.label}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] text-white/55 font-medium">{t(m.label)}</span>
                            <span className={`text-xs font-bold font-mono ${
                              m.color === "emerald" ? "text-iridescent-soft" :
                              m.color === "amber"   ? "text-white/70" : "text-white/40"
                            }`}>
                              {m.score.toFixed(0)}%
                            </span>
                          </div>
                          <MiniBar score={m.score} color={m.color} />
                          <p className="text-[10px] text-white/35 leading-snug mt-1.5 line-clamp-2">
                            {m.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Why / Concerns — both inline */}
                  {expl && (
                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      <div className="p-3 rounded-xl border border-white/[0.06]"
                        style={{ background: "rgba(34,211,238,0.04)", borderColor: "rgba(34,211,238,0.15)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-iridescent-soft mb-1.5">{t("Why Hire")}</p>
                        <p className="text-xs text-white/55 leading-relaxed">{L?.why_hire}</p>
                      </div>
                      <div className="p-3 rounded-xl border border-white/[0.06]"
                        style={{ background: "rgba(244,114,182,0.03)", borderColor: "rgba(244,114,182,0.15)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1.5">{t("Concerns")}</p>
                        <p className="text-xs text-white/50 leading-relaxed">{L?.why_not_hire}</p>
                      </div>
                    </div>
                  )}

                  {/* Matched / missing skills inline */}
                  {(app.matched_skills?.length > 0 || app.missing_skills?.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {app.matched_skills?.slice(0, 8).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md text-white/65 border border-white/[0.10]"
                          style={{ background: "rgba(34,211,238,0.06)" }}>{s}</span>
                      ))}
                      {app.missing_skills?.slice(0, 5).map((s) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md text-white/35 border border-white/[0.06]"
                          style={{ background: "rgba(244,114,182,0.03)" }}>{s}</span>
                      ))}
                    </div>
                  )}

                  {/* Recruiter note inline */}
                  {app.recruiter_notes && (
                    <p className="text-[11px] text-white/45 italic mt-3">
                      <span className="text-white/35 font-bold">Note:</span> "{app.recruiter_notes}"
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer summary */}
        {scored.length > 0 && (
          <div className="mt-8 p-5 rounded-2xl border border-white/[0.06] flex items-center gap-3"
            style={{ background: "var(--panel)" }}>
            <TrendingUp size={14} className="text-iridescent-soft" />
            <p className="text-xs text-white/50 leading-relaxed">
              <span className="text-iridescent-soft font-bold">{scored.length}</span> of {apps.length} candidates
              have been AI-scored with an average of <span className="text-iridescent-soft font-bold">{avgScore.toFixed(1)}%</span>.
              Top candidate scored <span className="text-iridescent-soft font-bold">{topScore.toFixed(1)}%</span>.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
