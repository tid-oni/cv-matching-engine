import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Briefcase, Users, Plus, ArrowRight,
  BarChart3, Brain, TrendingUp,
} from "lucide-react";
import { getMyJobs, getJobCandidates } from "../../api/platform";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import type { JobOffer, Application } from "../../types";

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [jobs, setJobs]     = useState<JobOffer[]>([]);
  const [topApps, setTopApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyJobs().then(async data => {
      setJobs(data);
      if (data.length > 0) {
        const apps = await getJobCandidates(data[0].id).catch(() => []);
        setTopApps(apps.slice(0, 5));
      }
    }).finally(() => setLoading(false));
  }, []);

  const totalApps  = jobs.reduce((s, j) => s + (j.application_count || 0), 0);
  const activeJobs = jobs.filter(j => j.is_active).length;
  const firstName  = user?.full_name.split(" ")[0] || "there";

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Brain size={22} className="text-white/40 animate-pulse" />
        </div>
        <p className="text-white/30 text-sm">{t("Loading your dashboard…")}</p>
      </div>
    </div>
  );

  const statItems = [
    { label: "Active Jobs",        value: activeJobs,  icon: Briefcase,  opacity: 1    },
    { label: "Total Applications", value: totalApps,   icon: Users,      opacity: 0.85 },
    { label: "Total Job Posts",    value: jobs.length, icon: BarChart3,  opacity: 0.7  },
    {
      label: "Avg. Applicants",
      value: jobs.length ? Math.round(totalApps / jobs.length) : 0,
      icon: TrendingUp,
      opacity: 0.55,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 relative">
      {/* Atmospheric blobs */}
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-10"  style={{ width: 360, height: 360, opacity: 0.25 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/3 -right-20" style={{ width: 340, height: 340, opacity: 0.22 }} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8 flex-wrap gap-4 relative z-10"
      >
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
            {t("Recruiter Dashboard")}
          </p>
          <h1 className="text-3xl font-bold font-display text-white mb-1">
            {t("Welcome back")}, {firstName}
          </h1>
          <p className="text-white/35 text-sm">
            {user?.company && <span>{user.company} · </span>}
            {t("Overview of your hiring pipeline")}
          </p>
        </div>
        <Link to="/recruiter/jobs/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}
        >
          <Plus size={15} />
          {t("Post a Job")}
        </Link>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 relative z-10"
      >
        {statItems.map(({ label, value, icon: Icon }, idx) => {
          // First two stats get the iridescent treatment (active jobs, applications)
          const isIridescent = idx < 2;
          return (
            <div key={label}
              className="rounded-2xl p-5 transition-all hover:-translate-y-0.5 duration-200"
              style={{ background: "var(--panel)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: isIridescent
                      ? "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))"
                      : "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}>
                  <Icon size={16} className={isIridescent ? "text-iridescent-soft" : "text-white/50"} />
                </div>
              </div>
              <div className={`text-2xl font-bold font-display mb-0.5 ${isIridescent ? "text-iridescent-soft" : "text-white/70"}`}>
                {value}
              </div>
              <div className="text-xs text-white/35">{t(label)}</div>
            </div>
          );
        })}
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-6">

        {/* Jobs list */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 rounded-2xl border border-white/[0.06] overflow-hidden"
          style={{ background: "var(--panel)" }}
        >
          <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.05]">
            <div className="flex items-center gap-2">
              <Briefcase size={14} className="text-white/40" />
              <span className="text-sm font-bold text-white">{t("Your Job Posts")}</span>
            </div>
            <Link to="/recruiter/jobs" className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
              {t("Manage all")} <ArrowRight size={11} />
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="py-16 text-center">
              <Briefcase size={28} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/30 text-sm mb-4">{t("No jobs posted yet")}</p>
              <Link to="/recruiter/jobs/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black bg-white hover:bg-white/90 transition-colors">
                <Plus size={13} /> {t("Post your first job")}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {jobs.slice(0, 6).map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.05 }}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate group-hover:text-white/70 transition-colors">
                      {job.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-white/25 mt-0.5">
                      <span>{job.company}</span>
                      {job.job_type && <span>· {job.job_type}</span>}
                      <div className={`w-1.5 h-1.5 rounded-full ${job.is_active ? "bg-white/60" : "bg-white/20"}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <Users size={11} />
                      {job.application_count || 0}
                    </div>
                    <Link
                      to={`/recruiter/jobs/${job.id}/candidates`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:bg-white/[0.06] transition-colors"
                    >
                      {t("View")} <ArrowRight size={11} />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick actions + top candidates */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick actions */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="rounded-2xl border border-white/[0.06] p-4 space-y-2"
            style={{ background: "var(--panel)" }}
          >
            <p className="text-xs font-bold text-white/25 uppercase tracking-wider mb-3">{t("Quick Actions")}</p>
            <Link to="/recruiter/jobs/new"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08]">
                <Plus size={16} className="text-white/50" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t("Post a Job")}</p>
                <p className="text-xs text-white/25">{t("Create a new listing")}</p>
              </div>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </Link>
            <Link to="/recruiter/jobs"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] transition-all group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08]">
                <BarChart3 size={16} className="text-white/50" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t("Manage Jobs")}</p>
                <p className="text-xs text-white/25">{t("Edit, toggle, delete")}</p>
              </div>
              <ArrowRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </Link>
          </motion.div>

          {/* Top candidates from first job */}
          {topApps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-2xl border border-white/[0.06] overflow-hidden"
              style={{ background: "var(--panel)" }}
            >
              <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center gap-2">
                <Brain size={13} className="text-white/40" />
                <span className="text-xs font-bold text-white">{t("Recent Candidates")}</span>
                <span className="text-xs text-white/25">({jobs[0]?.title})</span>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {topApps.map((app) => (
                  <div key={app.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black bg-white shrink-0">
                      {app.candidate_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{app.candidate_name}</p>
                      <p className="text-[10px] text-white/25 capitalize">{app.status}</p>
                    </div>
                    {app.match_score != null && (
                      <div className="text-xs font-bold text-white/60">
                        {app.match_score.toFixed(0)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-white/[0.05]">
                <Link to={`/recruiter/jobs/${jobs[0]?.id}/candidates`}
                  className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors">
                  {t("View all candidates")}
                  <ArrowRight size={11} />
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}