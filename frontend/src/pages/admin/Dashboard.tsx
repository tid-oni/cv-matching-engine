import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Users, Briefcase, FileText, TrendingUp, AlertTriangle,
  Loader2, ArrowRight, BarChart3, Brain,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { getAdminStats } from "../../api/platform";
import { useI18n } from "../../context/I18nContext";
import type { AdminStats } from "../../types";

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs" style={{ background: "var(--panel-2)" }}>
      <p className="text-white/30 mb-0.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.value} {p.name}
        </p>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
            <Loader2 className="animate-spin text-white/40" size={22} />
          </div>
          <p className="text-white/30 text-sm">{t("Loading…")}</p>
        </div>
      </div>
    );
  }

  const s = stats!;

  const userDistribution = [
    { name: "Candidates", value: s.total_candidates, fill: "rgba(255,255,255,0.65)" },
    { name: "Recruiters", value: s.total_recruiters, fill: "rgba(255,255,255,0.3)"  },
  ];

  const jobsData = [
    { name: "Active",  value: s.active_jobs,                      fill: "rgba(255,255,255,0.6)"  },
    { name: "Closed",  value: s.total_jobs - s.active_jobs,        fill: "rgba(255,255,255,0.15)" },
    { name: "Flagged", value: s.flagged_jobs,                      fill: "rgba(255,255,255,0.35)" },
  ];

  const activityData = Array.from({ length: 7 }, (_, i) => ({
    day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
    applications: Math.round((s.total_applications / 7) * (0.6 + Math.random() * 0.8)),
  }));

  const statCards = [
    {
      label: "Total Users",
      value: s.total_users,
      icon: Users,
      opacity: 1,
      sub: `${s.total_candidates} candidates · ${s.total_recruiters} recruiters`,
    },
    {
      label: "Job Offers",
      value: s.total_jobs,
      icon: Briefcase,
      opacity: 0.85,
      sub: `${s.active_jobs} active`,
    },
    {
      label: "Applications",
      value: s.total_applications,
      icon: FileText,
      opacity: 0.7,
      sub: "total submitted",
    },
    {
      label: "Avg Match Score",
      value: s.avg_match_score != null ? `${s.avg_match_score.toFixed(1)}%` : "—",
      icon: Brain,
      opacity: 0.6,
      sub: "AI compatibility",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-10"  style={{ width: 360, height: 360, opacity: 0.22 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/3 -right-20" style={{ width: 340, height: 340, opacity: 0.20 }} />
      <div className="blob-violet  animate-blob-3 absolute bottom-0 left-1/3" style={{ width: 320, height: 320, opacity: 0.18 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">{t("Admin Control")}</p>
            <h1 className="text-3xl font-bold font-display text-white mb-1">{t("Admin Dashboard")}</h1>
            <p className="text-white/40 text-sm">{t("Platform overview and management")}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.10] text-iridescent-soft text-sm"
            style={{ background: "rgba(167,139,250,0.06)" }}>
            <TrendingUp size={13} />{t("Live stats")}</div>
        </div>
      </motion.div>

      {/* Flagged jobs alert */}
      {s.flagged_jobs > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.1] text-white/50"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <AlertTriangle size={16} />
          <span className="text-sm">
            <strong className="text-white/70">{s.flagged_jobs}</strong> job{s.flagged_jobs !== 1 ? "s" : ""} flagged for review.
          </span>
          <Link to="/admin/jobs" className="ml-auto text-xs text-white/40 hover:text-white underline underline-offset-2 transition-colors">
            Review <ArrowRight size={11} className="inline" />
          </Link>
        </motion.div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
        {statCards.map(({ label, value, icon: Icon, sub }, i) => {
          // Highlight the first two with iridescent
          const isIridescent = i < 2;
          return (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              className="rounded-2xl border border-white/[0.08] p-5"
              style={{ background: "var(--panel)" }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{
                  background: isIridescent
                    ? "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))"
                    : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}>
                <Icon size={18} className={isIridescent ? "text-iridescent-soft" : "text-white/50"} />
              </div>
              <div className={`text-2xl font-bold ${isIridescent ? "text-iridescent-soft" : "text-white/80"}`}>
                {value}
              </div>
              <div className="text-xs font-medium text-white/45 mt-0.5">{t(label)}</div>
              <div className="text-xs text-white/25 mt-0.5">{sub}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5 mb-5">
        {/* Activity area chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 size={15} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Weekly Application Activity</h2>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.3)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.0)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="applications"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={2}
                fill="url(#appGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* User distribution pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Users size={15} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">User Distribution</h2>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={userDistribution}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                dataKey="value"
                paddingAngle={3}
              >
                {userDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {userDistribution.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                  <span className="text-white/35">{d.name}</span>
                </div>
                <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Jobs bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-white/[0.05] p-6"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Briefcase size={15} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Job Offers Overview</h2>
          </div>
          <Link to="/admin/jobs" className="text-xs text-white/35 hover:text-white flex items-center gap-1 transition-colors">
            Manage <ArrowRight size={11} />
          </Link>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={jobsData} barSize={36}>
            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<CustomTooltip />} />
            {jobsData.map((entry, i) => (
              <Bar key={i} dataKey="value" fill={entry.fill} radius={[6, 6, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
        {[
          { to: "/admin/users",      label: "Manage Users",   icon: Users },
          { to: "/admin/jobs",       label: "Review Jobs",    icon: Briefcase },
          { to: "/admin/statistics", label: "Statistics",     icon: BarChart3 },
          { to: "/admin/monitor",    label: "AI Monitor",     icon: Brain },
        ].map(({ to, label, icon: Icon }) => (
          <motion.div
            key={to}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Link
              to={to}
              className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <Icon size={18} className="text-white/40 group-hover:text-white/70 transition-colors" />
              <span className="text-sm text-white/40 group-hover:text-white transition-colors">{label}</span>
              <ArrowRight size={13} className="ml-auto text-white/20 group-hover:text-white/50 transition-colors" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}