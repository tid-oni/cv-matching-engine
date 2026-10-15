import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate } from "motion/react";
import {
  FileText, Clock, CheckCircle, XCircle, Star,
  ChevronDown, ThumbsUp, ThumbsDown, Lock, Brain,
  Building2, Calendar, Sparkles, TrendingUp, Radar as RadarIcon,
} from "lucide-react";
import { getMyApplications } from "../../api/platform";
import { AbilityRadar } from "@/components/ui/ability-radar";
import { useI18n } from "../../context/I18nContext";
import { localized } from "@/lib/explanation";
import type { Application } from "../../types";

const SCORE_VISIBLE = (status: string) => status === "hired" || status === "rejected";

const STATUS_CONFIG: Record<string, {
  icon: React.ReactNode; color: string; bg: string;
  headline: string; sub: string;
}> = {
  pending: {
    icon: <Clock size={15} />, color: "rgba(var(--ink-rgb),0.5)",
    bg: "rgba(var(--ink-rgb),0.05)", headline: "Under Review",
    sub: "Your application has been submitted and is waiting for the recruiter.",
  },
  reviewed: {
    icon: <Star size={15} />, color: "rgba(var(--ink-rgb),0.65)",
    bg: "rgba(var(--ink-rgb),0.06)", headline: "Being Reviewed",
    sub: "The recruiter has opened your application. A decision is coming soon.",
  },
  shortlisted: {
    icon: <CheckCircle size={15} />, color: "rgba(var(--ink-rgb),0.85)",
    bg: "rgba(var(--ink-rgb),0.08)", headline: "You're Shortlisted!",
    sub: "Great news — you made the shortlist! The recruiter will make a final decision soon.",
  },
  hired: {
    icon: <CheckCircle size={15} />, color: "rgb(var(--ink-rgb))",
    bg: "rgba(var(--ink-rgb),0.1)", headline: "You Got the Offer!",
    sub: "Congratulations! The recruiter has selected you. See your full AI score and analysis below.",
  },
  rejected: {
    icon: <XCircle size={15} />, color: "rgba(var(--ink-rgb),0.45)",
    bg: "rgba(var(--ink-rgb),0.04)", headline: "Not Selected This Time",
    sub: "The recruiter made their decision. See your score and detailed feedback to improve for next time.",
  },
};

function useCountUp(target: number, duration: number, go: boolean) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!go) return;
    const start = from.current;
    from.current = target;
    const c = animate(start, target, {
      duration, ease: "easeOut",
      onUpdate: n => setV(parseFloat(n.toFixed(1))),
    });
    return c.stop;
  }, [target, duration, go]);
  return v;
}

function ScoreReveal({ score, label, status }: { score: number; label: string; status: string }) {
  const { t } = useI18n();
  const [go, setGo] = useState(false);
  useEffect(() => {
    const tm = setTimeout(() => setGo(true), 400);
    return () => clearTimeout(tm);
  }, []);
  const display = useCountUp(score, 2, go);
  const pct = Math.min(score, 100);
  // Theme-aware: ink colour flips white↔dark via --ink-rgb. Strong scores get the iridescent ring.
  const strong = score >= 75, good = score >= 55;
  const ring = strong ? "url(#scoreGradStrong)" : good ? "url(#scoreGradMid)" : `rgba(var(--ink-rgb),0.45)`;
  const labelColor = strong ? "text-iridescent-soft" : good ? "text-white/70" : "text-white/45";
  const R = 56;
  const C = 2 * Math.PI * R;
  const offset = C - (C * pct) / 100;
  const isHired = status === "hired";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center py-6"
    >
      <div className="relative w-44 h-44 mb-4">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <defs>
            <linearGradient id="scoreGradStrong" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="scoreGradMid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(var(--ink-rgb),0.08)" strokeWidth="8" />
          <motion.circle
            cx="64" cy="64" r={R}
            fill="none"
            stroke={ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: go ? offset : C }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.4 }}
            style={{ filter: `blur(6px)`, opacity: 0.35 }}
          />
          <motion.circle
            cx="64" cy="64" r={R}
            fill="none"
            stroke={ring}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: go ? offset : C }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.4 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold font-display" style={{ color: "rgb(var(--ink-rgb))" }}>
            {display.toFixed(0)}
          </span>
          <span className="text-xs -mt-0.5" style={{ color: "rgba(var(--ink-rgb),0.3)" }}>/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-bold uppercase tracking-widest ${labelColor}`}>{label}</span>
      {isHired && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ color: "rgb(var(--ink-rgb))", background: "rgba(var(--ink-rgb),0.08)", border: "1px solid rgba(var(--ink-rgb),0.18)" }}
        >
          {t("Congratulations!")}
        </motion.div>
      )}
    </motion.div>
  );
}

function MetricBar({ label, score, color, explanation }: {
  label: string; score: number; color: string; explanation: string;
}) {
  const { t } = useI18n();
  const fillGradient =
    color === "emerald" ? "linear-gradient(90deg, #22d3ee, #a78bfa)" :
    color === "amber"   ? "linear-gradient(90deg, #a78bfa, #f472b6)" :
                          "linear-gradient(90deg, rgba(244,114,182,0.55), rgba(255,255,255,0.20))";
  const textClass =
    color === "emerald" ? "text-iridescent-soft" :
    color === "amber"   ? "text-white/65" : "text-white/40";

  return (
    <div>
      <div className="flex justify-between items-center mb-2 text-sm">
        <span className="text-white/70 font-semibold">{t(label)}</span>
        <span className={`font-bold text-sm font-mono ${textClass}`}>{score.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full mb-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: fillGradient }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 1.4, ease: [0.4,0,0.2,1], delay: 0.1 }}
        />
      </div>
      {/* Explanation always visible */}
      <p className="text-xs text-white/45 leading-relaxed">
        {explanation}
      </p>
    </div>
  );
}

function LockedScore({ status }: { status: string }) {
  const { t } = useI18n();
  const isShortlisted = status === "shortlisted";
  return (
    <div className="flex flex-col items-center gap-3 py-6 px-4 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: isShortlisted ? "rgba(var(--ink-rgb),0.08)" : "rgba(var(--ink-rgb),0.05)",
          border: isShortlisted ? "1px solid rgba(var(--ink-rgb),0.2)" : "1px solid rgba(var(--ink-rgb),0.08)",
        }}
      >
        <Lock size={24} className={isShortlisted ? "text-white/60" : "text-white/25"} />
      </div>
      <div>
        <p className={`font-semibold ${isShortlisted ? "text-white/70" : "text-white/30"}`}>
          {isShortlisted ? t("Score will reveal soon") : t("Waiting for recruiter decision")}
        </p>
        <p className="text-xs text-white/20 mt-1 leading-relaxed max-w-[240px]">
          {isShortlisted
            ? t("You're shortlisted! Your AI score and full analysis will be revealed once the recruiter approves or rejects.")
            : t("Your score and detailed analysis will appear here after the recruiter reviews your application.")
          }
        </p>
      </div>
    </div>
  );
}

function ApplicationCard({ app, idx }: { app: Application; idx: number }) {
  const { t, lang } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const scoreVisible = SCORE_VISIBLE(app.status);
  const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
  const expl = scoreVisible ? app.explanation : null;
  const L = expl ? localized(expl, lang) : null;
  const breakdown = L?.metric_breakdown;
  const cmsg = L?.candidate_message;

  const borderStyle =
    app.status === "hired"       ? "rgba(255,255,255,0.25)" :
    app.status === "shortlisted" ? "rgba(255,255,255,0.15)" :
    app.status === "rejected"    ? "rgba(255,255,255,0.06)" :
                                   "rgba(255,255,255,0.08)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, duration: 0.5, ease: [0.22,1,0.36,1] }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--panel)", borderColor: borderStyle }}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Status badge */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3"
              style={{ background: config.bg, color: config.color }}
            >
              {config.icon}
              <span>{t(config.headline)}</span>
            </div>

            <h3 className="font-bold text-white text-lg leading-tight mb-1">{app.job_title}</h3>

            <div className="flex items-center gap-3 text-xs text-white/30 mb-3">
              <span className="flex items-center gap-1"><Building2 size={10} />{app.job_company}</span>
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>

            <p className="text-sm text-white/35 leading-relaxed">{t(config.sub)}</p>
          </div>

          {/* Score preview or lock */}
          <div className="shrink-0">
            {scoreVisible && app.match_score != null ? (
              <div className="text-center">
                <div
                  className="text-3xl font-bold font-display"
                  style={{ color: app.match_score >= 55 ? "rgb(var(--ink-rgb))" : "rgba(var(--ink-rgb),0.5)" }}
                >
                  {app.match_score.toFixed(0)}
                </div>
                <div className="text-[10px]" style={{ color: "rgba(var(--ink-rgb),0.25)" }}>/ 100</div>
                <div className="text-[10px] text-white/25 mt-0.5">{t("AI Score")}</div>
              </div>
            ) : !scoreVisible ? (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(var(--ink-rgb),0.05)", border: "1px solid rgba(var(--ink-rgb),0.08)" }}
                >
                  <Lock size={14} className="text-white/20" />
                </div>
                <span className="text-[9px] text-white/20 font-medium">{t("Locked")}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Expand button */}
        {(scoreVisible || ["shortlisted", "reviewed"].includes(app.status)) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-medium mt-3 transition-colors"
            style={{ color: scoreVisible ? config.color : "rgba(var(--ink-rgb),0.3)" }}
          >
            {expanded ? t("Hide details") : scoreVisible ? t("View full analysis") : t("View details")}
            <ChevronDown size={12} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4,0,0.2,1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-5 pb-6 pt-5 space-y-6">

              {scoreVisible && expl ? (
                <>
                  {/* Score ring */}
                  <ScoreReveal score={expl.overall_score} label={t(expl.overall_label)} status={app.status} />

                  {/* Personalized candidate message (localized) — falls back to old why text */}
                  {cmsg ? (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest mb-3 text-iridescent-soft">
                        {cmsg.headline}
                      </h4>
                      <div
                        className="flex items-start gap-3 p-4 rounded-2xl border mb-5"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderColor: app.status === "rejected" ? "rgba(244,114,182,0.18)" : "rgba(167,139,250,0.20)",
                        }}
                      >
                        {app.status === "rejected"
                          ? <ThumbsDown size={16} className="text-white/35 mt-0.5 shrink-0" />
                          : <ThumbsUp   size={16} className="text-white/70 mt-0.5 shrink-0" />
                        }
                        <p className="text-sm text-white/65 leading-relaxed">
                          {cmsg.feedback}
                        </p>
                      </div>

                      {/* Improvement areas */}
                      {cmsg.improvement_areas?.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {cmsg.improvement_areas.map((area, i) => (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl border border-white/[0.06]"
                              style={{ background: "rgba(255,255,255,0.025)" }}
                            >
                              <p className="text-xs font-bold uppercase tracking-wider text-iridescent-soft mb-1.5">
                                {area.title}
                              </p>
                              <p className="text-xs text-white/50 leading-relaxed mb-2">
                                {area.detail}
                              </p>
                              {area.items.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {area.items.map(item => (
                                    <span
                                      key={item}
                                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] text-white/55 border border-white/[0.08]"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Encouragement */}
                      <p className="text-xs italic text-white/55 leading-relaxed mb-2">
                        <Sparkles size={11} className="inline mr-1 -mt-0.5 text-white/40" />
                        {cmsg.encouragement}
                      </p>
                    </div>
                  ) : (
                    /* Fallback for old scores without candidate_message */
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest mb-3 text-white/25">
                        {app.status === "rejected" ? t("Why your application wasn't selected") : t("Why you were chosen")}
                      </h4>
                      <div
                        className="flex items-start gap-3 p-4 rounded-2xl border mb-4"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderColor: app.status === "rejected" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)",
                        }}
                      >
                        {app.status === "rejected"
                          ? <ThumbsDown size={16} className="text-white/30 mt-0.5 shrink-0" />
                          : <ThumbsUp   size={16} className="text-white/60 mt-0.5 shrink-0" />
                        }
                        <p className="text-sm text-white/50 leading-relaxed">
                          {app.status === "rejected" ? L?.why_not_hire : L?.why_hire}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Ability radar */}
                  {(breakdown || app.match_score != null) && (
                    <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <h4 className="text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2 text-iridescent-soft">
                        <RadarIcon size={11} />
                        {t("Your Ability Profile")}
                      </h4>
                      <p className="text-xs text-white/35 mb-2">
                        {t("Your strengths and gaps across the role's key competency areas.")}
                      </p>
                      <AbilityRadar app={app} height={300} />
                    </div>
                  )}

                  {/* Score breakdown */}
                  {breakdown && (
                    <div>
                      <h4 className="text-xs font-bold text-white/25 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <TrendingUp size={11} />
                        {t("Score Breakdown")}
                      </h4>
                      <div className="space-y-5">
                        {Object.values(breakdown).map(m => (
                          <MetricBar key={m.label} label={m.label} score={m.score}
                            color={m.color} explanation={m.explanation} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {(app.matched_skills?.length > 0 || app.missing_skills?.length > 0) && (
                    <div className="grid sm:grid-cols-2 gap-5">
                      {app.matched_skills?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2.5">
                            {t("Your Matching Skills")} ({app.matched_skills.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {app.matched_skills.map(s => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded-lg bg-white/[0.07] text-white/60 border border-white/[0.1]">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {app.missing_skills?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2.5">
                            {t("Skills to Develop")} ({app.missing_skills.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {app.missing_skills.map(s => (
                              <span key={s} className="text-xs px-2 py-0.5 rounded-lg bg-white/[0.03] text-white/30 border border-white/[0.06]">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recruiter note */}
                  {app.recruiter_notes && (
                    <div className="p-4 rounded-2xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2">{t("Recruiter Note")}</p>
                      <p className="text-sm text-white/40 leading-relaxed italic">"{app.recruiter_notes}"</p>
                    </div>
                  )}
                </>
              ) : (
                <LockedScore status={app.status} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Applications() {
  const { t } = useI18n();
  const [apps, setApps]     = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getMyApplications().then(setApps).finally(() => setLoading(false));
  }, []);

  const statuses = ["all", "pending", "reviewed", "shortlisted", "hired", "rejected"];
  const filtered = filter === "all" ? apps : apps.filter(a => a.status === filter);

  const hired       = apps.filter(a => a.status === "hired").length;
  const shortlisted = apps.filter(a => a.status === "shortlisted").length;
  const pending     = apps.filter(a => a.status === "pending" || a.status === "reviewed").length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Brain size={22} className="text-white/40 animate-pulse" />
        </div>
        <p className="text-white/30 text-sm">{t("Loading your applications…")}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold font-display text-white mb-1">{t("My Applications")}</h1>
        <p className="text-white/30 text-sm mb-6">
          {t("Track all your job applications and their current status.")}
        </p>

        {/* Summary cards */}
        {apps.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { label: "Total",       v: apps.length, opacity: 1    },
              { label: "In Progress", v: pending,      opacity: 0.6  },
              { label: "Shortlisted", v: shortlisted,  opacity: 0.75 },
              { label: "Accepted",    v: hired,        opacity: 1    },
            ].map(({ label, v, opacity }) => (
              <div key={label} className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-2xl font-bold font-display text-white" style={{ opacity }}>{v}</div>
                <div className="text-xs mt-0.5 text-white/30">{t(label)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="p-3.5 rounded-2xl mb-6 flex items-start gap-3"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Sparkles size={14} className="text-white/40 mt-0.5 shrink-0" />
          <p className="text-xs text-white/35 leading-relaxed">
            <span className="text-white/60 font-semibold">{t("Score privacy:")} </span>
            {t("Your AI match score and detailed analysis are hidden until the recruiter approves or rejects your application. This ensures a fair process.")}
          </p>
        </div>
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
        {statuses.map(s => {
          const count = s === "all" ? apps.length : apps.filter(a => a.status === s).length;
          const label = s === "all" ? t("All") : t(s.charAt(0).toUpperCase() + s.slice(1));
          const active = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? "text-white shadow-sm"
                  : "text-white/40 hover:text-white border border-white/[0.06] hover:bg-white/[0.05]"
              }`}
              style={active ? { background: "linear-gradient(90deg,#22d3ee,#a78bfa)" } : undefined}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Applications list */}
      {filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl border border-white/[0.06] flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <FileText size={28} className="text-white/20" />
          </div>
          <p className="text-white/30 font-medium mb-1.5">
            {filter === "all" ? t("No applications yet") : `${t("No applications")} « ${t(filter.charAt(0).toUpperCase() + filter.slice(1))} »`}
          </p>
          {filter === "all" && (
            <p className="text-xs text-white/20">{t("Browse jobs and apply to start tracking your progress")}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app, i) => (
            <ApplicationCard key={app.id} app={app} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}