import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3, Users, Briefcase, TrendingUp, Brain,
  ChevronDown, ArrowRight, Trophy, CheckCircle, XCircle,
  Clock, Star, Loader2, RefreshCw, Target,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { getAdminStats, getJobs, getJobCandidates } from "../../api/platform";
import { useI18n } from "../../context/I18nContext";
import type { AdminStats, JobOffer, Application } from "../../types";

/* ── Types ──────────────────────────────────────────────────────── */
interface JobStats {
  job: JobOffer;
  applications: Application[];
  scored: Application[];
  avgScore: number;
  topScore: number;
  acceptRate: number;
  rejectRate: number;
  shortlistRate: number;
  statusCounts: Record<string, number>;
  scoreDistribution: Array<{ range: string; count: number; fill: string }>;
}

/* ── Custom tooltip ─────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs" style={{ background: "var(--panel-2)" }}>
      <p className="text-white/30 mb-0.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || "#fff" }} className="font-semibold">
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
};

/* ── Score ring mini ─────────────────────────────────────────────── */
function ScoreRingMini({ score, size = 56 }: { score: number; size?: number }) {
  const R = size / 2 - 5;
  const C = 2 * Math.PI * R;
  const offset = C - (C * Math.min(score, 100)) / 100;
  const color = score >= 75 ? "#ffffff" : score >= 55 ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <motion.circle
        cx={size/2} cy={size/2} r={R}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={C}
        initial={{ strokeDashoffset: C }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
      />
    </svg>
  );
}

/* ── Job stats card ─────────────────────────────────────────────── */
function JobStatCard({ jobStats, rank, idx }: { jobStats: JobStats; rank: number; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const { job, applications, scored, avgScore, topScore, acceptRate, statusCounts } = jobStats;

  const rankColor =
    rank === 1 ? "rgba(255,255,255,0.5)" :
    rank === 2 ? "rgba(255,255,255,0.25)" :
    rank === 3 ? "rgba(255,255,255,0.18)" :
    "rgba(255,255,255,0.07)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: rankColor, background: "var(--panel)" }}
    >
      {/* Header row */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
            style={{
              background: rank <= 3 ? `rgba(255,255,255,${0.8 - (rank-1)*0.2})` : "rgba(255,255,255,0.05)",
              color: rank <= 3 ? "#000" : "rgba(255,255,255,0.3)",
            }}
          >
            {rank <= 1 ? <Trophy size={14} /> : rank}
          </div>

          {/* Job info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-white text-base leading-tight mb-0.5">{job.title}</h3>
                <p className="text-xs text-white/30">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
              </div>

              {/* Score ring */}
              {scored.length > 0 && (
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative">
                    <ScoreRingMini score={avgScore} size={52} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{avgScore.toFixed(0)}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-white/20 mt-0.5">avg</span>
                </div>
              )}
            </div>

            {/* Quick stats row */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Users size={11} />
                <span>{applications.length} applicants</span>
              </div>
              {scored.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <Brain size={11} />
                    <span>{scored.length} scored</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/40">
                    <Target size={11} />
                    <span>Top: {topScore.toFixed(0)}%</span>
                  </div>
                  {acceptRate > 0 && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <CheckCircle size={11} />
                      <span>{acceptRate.toFixed(0)}% accept rate</span>
                    </div>
                  )}
                </>
              )}
              {!job.is_active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/25 border border-white/[0.06]">Closed</span>
              )}
            </div>
          </div>

          {/* Expand */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/[0.05] transition-all shrink-0"
          >
            <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Status breakdown bar */}
        {applications.length > 0 && (
          <div className="mt-4 ml-[52px]">
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              {[
                { key: "hired",       fill: "rgba(255,255,255,0.9)" },
                { key: "shortlisted", fill: "rgba(255,255,255,0.6)" },
                { key: "reviewed",    fill: "rgba(255,255,255,0.35)" },
                { key: "pending",     fill: "rgba(255,255,255,0.18)" },
                { key: "rejected",    fill: "rgba(255,255,255,0.08)" },
              ].map(({ key, fill }) => {
                const count = statusCounts[key] || 0;
                const pct = (count / applications.length) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={key}
                    style={{ width: `${pct}%`, background: fill }}
                    title={`${key}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {[
                { key: "hired",       icon: <CheckCircle size={9} />, label: "Hired" },
                { key: "shortlisted", icon: <Star size={9} />,        label: "Shortlisted" },
                { key: "rejected",    icon: <XCircle size={9} />,     label: "Rejected" },
                { key: "pending",     icon: <Clock size={9} />,       label: "Pending" },
              ].map(({ key, icon, label }) => {
                const count = statusCounts[key] || 0;
                if (count === 0) return null;
                return (
                  <span key={key} className="flex items-center gap-1 text-[10px] text-white/25">
                    {icon} {count} {label}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Expanded analysis */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-white/[0.05]"
          >
            <div className="p-5 space-y-5">
              {scored.length > 0 ? (
                <>
                  {/* Score distribution chart */}
                  <div>
                    <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <BarChart3 size={10} /> Score Distribution
                    </p>
                    <ResponsiveContainer width="100%" height={80}>
                      <BarChart data={jobStats.scoreDistribution} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
                        <XAxis dataKey="range" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {jobStats.scoreDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top 3 candidates */}
                  {scored.slice(0, 3).length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Trophy size={10} /> Top Candidates
                      </p>
                      <div className="space-y-2">
                        {scored.slice(0, 3).map((app, i) => (
                          <div
                            key={app.id}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.05]"
                            style={{ background: "rgba(255,255,255,0.02)" }}
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{
                                background: i === 0 ? "rgba(255,255,255,0.9)" : i === 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)",
                                color: "#000",
                              }}
                            >
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{app.candidate_name || "Candidate"}</p>
                              <p className="text-[10px] text-white/25 capitalize">{app.status}</p>
                            </div>
                            <div className="text-sm font-bold font-display"
                              style={{ color: (app.match_score || 0) >= 75 ? "#fff" : "rgba(255,255,255,0.6)" }}>
                              {app.match_score?.toFixed(1) || "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <Brain size={22} className="text-white/15 mx-auto mb-2" />
                  <p className="text-xs text-white/25">No AI scores yet for this job</p>
                  <p className="text-[10px] text-white/15 mt-0.5">Recruiter needs to run AI analysis first</p>
                </div>
              )}

              {/* View candidates link */}
              <Link
                to={`/recruiter/jobs/${job.id}/candidates`}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white/40 border border-white/[0.07] hover:bg-white/[0.04] hover:text-white transition-all"
              >
                View All Candidates
                <ArrowRight size={11} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Statistics page ────────────────────────────────────────── */
export default function Statistics() {
  const { t } = useI18n();
  const [stats, setStats]       = useState<AdminStats | null>(null);
  const [jobs, setJobs]         = useState<JobOffer[]>([]);
  const [jobStats, setJobStats] = useState<JobStats[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [filter, setFilter]     = useState<"all" | "active" | "closed">("all");

  /* Load admin stats + jobs */
  useEffect(() => {
    Promise.all([getAdminStats(), getJobs()])
      .then(([s, j]) => {
        setStats(s);
        setJobs(j.jobs);
      })
      .finally(() => setLoading(false));
  }, []);

  /* Load per-job candidate stats */
  useEffect(() => {
    if (jobs.length === 0) return;
    setLoadingJobs(true);
    Promise.allSettled(
      jobs.slice(0, 20).map((job) =>
        getJobCandidates(job.id)
          .then((apps) => ({ job, apps }))
          .catch(() => ({ job, apps: [] as Application[] }))
      )
    )
      .then((results) => {
        const stats: JobStats[] = results
          .filter((r): r is PromiseFulfilledResult<{ job: JobOffer; apps: Application[] }> => r.status === "fulfilled")
          .map(({ value: { job, apps } }) => {
            const scored = apps.filter((a) => a.match_score != null).sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
            const avgScore = scored.length ? scored.reduce((s, a) => s + (a.match_score || 0), 0) / scored.length : 0;
            const topScore = scored.length ? scored[0].match_score || 0 : 0;
            const hired = apps.filter((a) => a.status === "hired").length;
            const rejected = apps.filter((a) => a.status === "rejected").length;
            const shortlisted = apps.filter((a) => a.status === "shortlisted").length;
            const acceptRate = apps.length ? (hired / apps.length) * 100 : 0;
            const rejectRate = apps.length ? (rejected / apps.length) * 100 : 0;
            const shortlistRate = apps.length ? (shortlisted / apps.length) * 100 : 0;
            const statusCounts = apps.reduce((acc, a) => {
              acc[a.status] = (acc[a.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            const scoreDistribution = [
              { range: "0–40",  count: scored.filter((a) => (a.match_score || 0) < 40).length,               fill: "rgba(255,255,255,0.2)" },
              { range: "40–55", count: scored.filter((a) => (a.match_score || 0) >= 40 && (a.match_score || 0) < 55).length, fill: "rgba(255,255,255,0.35)" },
              { range: "55–70", count: scored.filter((a) => (a.match_score || 0) >= 55 && (a.match_score || 0) < 70).length, fill: "rgba(255,255,255,0.5)" },
              { range: "70–85", count: scored.filter((a) => (a.match_score || 0) >= 70 && (a.match_score || 0) < 85).length, fill: "rgba(255,255,255,0.7)" },
              { range: "85+",   count: scored.filter((a) => (a.match_score || 0) >= 85).length,               fill: "rgba(255,255,255,0.9)" },
            ];
            return { job, applications: apps, scored, avgScore, topScore, acceptRate, rejectRate, shortlistRate, statusCounts, scoreDistribution };
          })
          .sort((a, b) => b.applications.length - a.applications.length);

        setJobStats(stats);
      })
      .finally(() => setLoadingJobs(false));
  }, [jobs]);

  const filtered = jobStats.filter((js) => {
    if (filter === "active") return js.job.is_active;
    if (filter === "closed") return !js.job.is_active;
    return true;
  });

  const totalApplications = jobStats.reduce((s, j) => s + j.applications.length, 0);
  const totalScored = jobStats.reduce((s, j) => s + j.scored.length, 0);
  const overallAvg = totalScored
    ? jobStats.reduce((s, j) => s + j.avgScore * j.scored.length, 0) / totalScored
    : 0;
  const totalHired = jobStats.reduce((s, j) => s + (j.statusCounts["hired"] || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
            <Loader2 className="animate-spin text-white/40" size={22} />
          </div>
          <p className="text-white/30 text-sm">Loading statistics…</p>
        </div>
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-10"  style={{ width: 340, height: 340, opacity: 0.22 }} />
      <div className="blob-violet  animate-blob-2 absolute top-1/3 -right-20" style={{ width: 360, height: 360, opacity: 0.20 }} />
      <div className="blob-magenta animate-blob-3 absolute bottom-0 left-1/4" style={{ width: 320, height: 320, opacity: 0.18 }} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
              {t("Admin · Analytics")}
            </p>
            <h1 className="text-3xl font-bold font-display text-white mb-1">{t("Platform Statistics")}</h1>
            <p className="text-white/40 text-sm">Per-job performance · candidate outcomes · AI scoring analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.10] text-iridescent-soft text-xs"
              style={{ background: "rgba(167,139,250,0.06)" }}>
              <TrendingUp size={11} />
              Live analytics
            </div>
          </div>
        </div>
      </motion.div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Jobs",        value: s.total_jobs,         icon: Briefcase,  sub: `${s.active_jobs} active`                         },
          { label: "Total Applications", value: totalApplications,   icon: Users,      sub: `across ${jobStats.length} jobs`                   },
          { label: "AI Scored",         value: totalScored,          icon: Brain,      sub: `${totalApplications ? ((totalScored/totalApplications)*100).toFixed(0) : 0}% of all apps` },
          { label: "Overall Avg Score", value: `${overallAvg.toFixed(1)}%`, icon: Target, sub: "across all scored"                           },
        ].map(({ label, value, icon: Icon, sub }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05 }}
            className="rounded-2xl border border-white/[0.06] p-5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-3">
              <Icon size={18} className="text-white/40" />
            </div>
            <div className="text-2xl font-bold text-white font-display">{value}</div>
            <div className="text-xs font-medium text-white/40 mt-0.5">{label}</div>
            <div className="text-[10px] text-white/20 mt-0.5">{sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Overview charts */}
      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        {/* Application funnel */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={14} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Applications per Job (Top 10)</h2>
            {loadingJobs && <Loader2 size={12} className="animate-spin text-white/30 ml-auto" />}
          </div>
          {jobStats.slice(0, 10).length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={jobStats.slice(0, 10).map((j) => ({
                  name: j.job.title.length > 14 ? j.job.title.slice(0, 14) + "…" : j.job.title,
                  Applications: j.applications.length,
                  Scored: j.scored.length,
                }))}
                margin={{ top: 0, right: 0, bottom: 0, left: -22 }}
              >
                <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Applications" fill="rgba(255,255,255,0.3)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Scored"       fill="rgba(255,255,255,0.6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-white/20 text-sm">{loadingJobs ? "Loading job data…" : "No job data yet"}</p>
            </div>
          )}
        </motion.div>

        {/* Radial overview */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/[0.05] p-6 flex flex-col"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Target size={14} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Funnel Overview</h2>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3">
            {[
              { label: "Total Applications", value: totalApplications, opacity: 1 },
              { label: "AI Scored",          value: totalScored,       opacity: 0.7 },
              { label: "Shortlisted",
                value: jobStats.reduce((s, j) => s + (j.statusCounts["shortlisted"] || 0) + (j.statusCounts["hired"] || 0), 0),
                opacity: 0.55 },
              { label: "Hired",              value: totalHired,        opacity: 0.4 },
            ].map(({ label, value, opacity }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: `rgba(255,255,255,${opacity + 0.2})` }}>{label}</span>
                  <span className="font-bold text-white" style={{ opacity }}>{value}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: totalApplications ? `${(value / totalApplications) * 100}%` : "0%",
                      background: `rgba(255,255,255,${opacity})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Per-job breakdown */}
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-white font-display flex items-center gap-2">
            <Briefcase size={18} className="text-white/40" />
            Job Performance
            {loadingJobs && <RefreshCw size={13} className="animate-spin text-white/25" />}
          </h2>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {(["all", "active", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                  filter === f ? "bg-white text-black" : "text-white/30 border border-white/[0.06] hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl border border-white/[0.06] flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(255,255,255,0.02)" }}>
              <Briefcase size={26} className="text-white/20" />
            </div>
            <p className="text-white/25 font-medium">
              {loadingJobs ? "Loading job statistics…" : "No jobs match this filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((js, i) => (
              <JobStatCard key={js.job.id} jobStats={js} rank={i + 1} idx={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}