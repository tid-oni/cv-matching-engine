import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence, animate } from "motion/react";
import {
  ArrowLeft, Users, Loader2, Download, ChevronDown,
  CheckCircle, XCircle, Clock, Star, Brain, Trophy,
  BarChart3, ArrowRight, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  getJobCandidates, updateApplicationStatus, getJob, scoreAllCandidates,
} from "../../api/platform";
import { useToast } from "../../context/ToastContext";
import { useI18n } from "../../context/I18nContext";
import type { Application, JobOffer } from "../../types";

const STATUSES = ["pending", "reviewed", "shortlisted", "rejected", "hired"] as const;

const STATUS_META: Record<string, { icon: React.ReactNode; cls: string; bg: string; border: string }> = {
  pending:     { icon: <Clock       size={11} />, cls: "text-white/55",        bg: "rgba(255,255,255,0.05)",  border: "rgba(255,255,255,0.08)" },
  reviewed:    { icon: <Star        size={11} />, cls: "text-white/70",        bg: "rgba(255,255,255,0.07)",  border: "rgba(255,255,255,0.10)" },
  shortlisted: { icon: <CheckCircle size={11} />, cls: "text-iridescent-soft", bg: "rgba(167,139,250,0.10)",  border: "rgba(167,139,250,0.30)" },
  rejected:    { icon: <XCircle     size={11} />, cls: "text-white/40",        bg: "rgba(244,114,182,0.06)",  border: "rgba(244,114,182,0.18)" },
  hired:       { icon: <Trophy      size={11} />, cls: "text-iridescent",      bg: "rgba(34,211,238,0.10)",   border: "rgba(34,211,238,0.35)"  },
};

function rankBorderColor(rank: number, scored: boolean) {
  if (!scored) return "rgba(255,255,255,0.07)";
  if (rank === 1) return "rgba(34,211,238,0.40)";
  if (rank === 2) return "rgba(167,139,250,0.28)";
  if (rank === 3) return "rgba(244,114,182,0.24)";
  return "rgba(255,255,255,0.07)";
}

function AnimScore({ score }: { score: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    from.current = score;
    const c = animate(start, score, {
      duration: 1.4, ease: "easeOut",
      onUpdate: n => setV(parseFloat(n.toFixed(1))),
    });
    return c.stop;
  }, [score]);
  return <>{v.toFixed(1)}</>;
}

/* ── Status dropdown — unchanged in behavior, lightly themed ────── */
function StatusDropdown({ app, onChange }: {
  app: Application; onChange: (id: number, s: string, notes?: string) => Promise<void>;
}) {
  const [open, setOpen]                 = useState(false);
  const [busy, setBusy]                 = useState(false);
  const [showNote, setShowNote]         = useState(false);
  const [note, setNote]                 = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const meta = STATUS_META[app.status];

  const select = async (s: string) => {
    setOpen(false);
    if ((s === "hired" || s === "rejected") && !showNote) {
      setPendingStatus(s);
      setShowNote(true);
      return;
    }
    setBusy(true);
    await onChange(app.id, s);
    setBusy(false);
  };

  const confirmWithNote = async () => {
    if (!pendingStatus) return;
    setBusy(true);
    setShowNote(false);
    await onChange(app.id, pendingStatus, note || undefined);
    setBusy(false);
    setNote("");
    setPendingStatus(null);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
        style={{ background: meta.bg, borderColor: meta.border }}
      >
        {busy
          ? <Loader2 size={11} className="animate-spin text-white/40" />
          : <span className={meta.cls}>{meta.icon}</span>
        }
        <span className={`${meta.cls} capitalize`}>{app.status}</span>
        <ChevronDown size={11} className="text-white/30" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full mt-1 w-44 rounded-2xl border border-white/[0.10] shadow-2xl z-30 overflow-hidden"
            style={{ background: "var(--panel-2)", backdropFilter: "blur(20px)" }}
          >
            {STATUSES.map(s => {
              const m = STATUS_META[s];
              const isFinal = s === "hired" || s === "rejected";
              return (
                <button key={s} onClick={() => select(s)}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-colors capitalize ${
                    s === app.status ? "text-white bg-white/[0.08]" : "text-white/50 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className={m.cls}>{m.icon}</span>
                  {s}
                  {isFinal && <span className="ml-auto text-[10px] text-white/25">final</span>}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
            onClick={() => { setShowNote(false); setPendingStatus(null); }}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-white/[0.10] p-6"
              style={{ background: "var(--panel-2)", backdropFilter: "blur(24px)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                {pendingStatus === "hired"
                  ? <CheckCircle size={18} className="text-iridescent-soft" />
                  : <XCircle     size={18} className="text-white/50" />
                }
                <h3 className="font-bold text-white text-lg capitalize">
                  {pendingStatus === "hired" ? "Accept Candidate" : "Reject Candidate"}
                </h3>
              </div>
              <p className="text-sm text-white/45 mb-4 leading-relaxed">
                {pendingStatus === "hired"
                  ? "This reveals their full AI score and analysis in the candidate's dashboard."
                  : "This reveals their score with personalized feedback in the candidate's dashboard."
                }
              </p>
              <label className="field-label">Add a note for the candidate <span className="text-white/25">(optional)</span></label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={pendingStatus === "hired"
                  ? "e.g. We were impressed by your portfolio and team fit..."
                  : "e.g. We're looking for more hands-on experience in this area..."
                }
                rows={3}
                className="field text-sm resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={confirmWithNote}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: pendingStatus === "hired"
                      ? "linear-gradient(135deg, #22d3ee, #a78bfa)"
                      : "rgba(255,255,255,0.10)",
                    color: pendingStatus === "hired" ? "#000" : "#fff",
                  }}
                >
                  {pendingStatus === "hired"
                    ? <><CheckCircle size={14} /> Confirm Acceptance</>
                    : <><XCircle size={14} /> Confirm Rejection</>
                  }
                </button>
                <button
                  onClick={() => { setShowNote(false); setPendingStatus(null); }}
                  className="px-4 py-2.5 rounded-xl text-sm text-white/45 border border-white/[0.10] hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg shrink-0 text-black"
      style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}>
      <Trophy size={13} />
    </div>
  );
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md shrink-0 text-black font-bold"
      style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.85), rgba(244,114,182,0.85))" }}>2</div>
  );
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs shadow-md shrink-0 text-black font-bold"
      style={{ background: "linear-gradient(135deg, rgba(244,114,182,0.75), rgba(255,255,255,0.6))" }}>3</div>
  );
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white/35 shrink-0"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {rank}
    </div>
  );
}

export default function Candidates() {
  const { jobId } = useParams();
  const navigate  = useNavigate();
  const { success, error: toastError, info } = useToast();
  const { t } = useI18n();
  const [apps, setApps]       = useState<Application[]>([]);
  const [job, setJob]         = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [filter, setFilter]   = useState("all");

  useEffect(() => {
    const id = Number(jobId);
    Promise.all([getJobCandidates(id), getJob(id)])
      .then(([a, j]) => { setApps(a); setJob(j); })
      .finally(() => setLoading(false));
  }, [jobId]);

  const runScoring = async () => {
    if (apps.length === 0) return;
    setScoring(true);
    info("AI Analysis started", `Scoring ${apps.length} candidate${apps.length !== 1 ? "s" : ""}…`);
    try {
      const results = await scoreAllCandidates(Number(jobId));
      setApps(results);
      success("Scoring complete!", `${results.filter(a => a.match_score != null).length} candidates ranked.`);
    } catch {
      toastError("Scoring failed", "Please try again.");
    } finally {
      setScoring(false);
    }
  };

  const handleStatus = async (appId: number, status: string, notes?: string) => {
    try {
      await updateApplicationStatus(appId, status, notes);
      setApps(prev => prev.map(a => a.id === appId
        ? { ...a, status: status as Application["status"], recruiter_notes: notes || a.recruiter_notes }
        : a
      ));
      if (status === "hired")    success("Candidate accepted", "Their score and full analysis are now visible in their dashboard.");
      if (status === "rejected") info("Candidate rejected",   "Your feedback and their score are now visible in their dashboard.");
    } catch {
      toastError("Update failed", "Please try again.");
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Rank","Name","Email","Score","Label","Status","Matched","Missing","Applied"],
      ...apps.map((a, i) => [
        i+1, a.candidate_name||"", a.candidate_email||"",
        a.match_score?.toFixed(1)||"", a.explanation?.overall_label||"",
        a.status,
        (a.matched_skills||[]).join("; "),
        (a.missing_skills||[]).join("; "),
        new Date(a.created_at).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a   = document.createElement("a");
    a.href = url; a.download = `candidates-${jobId}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = filter === "all" ? apps : apps.filter(a => a.status === filter);
  const scored   = apps.filter(a => a.match_score != null);
  const avgScore = scored.length ? scored.reduce((s,a) => s+(a.match_score||0),0)/scored.length : 0;
  const topScore = scored.length ? Math.max(...scored.map(a => a.match_score||0)) : 0;
  const counts   = STATUSES.reduce((acc,s) => { acc[s]=apps.filter(a=>a.status===s).length; return acc; }, {} as Record<string,number>);

  const chartData = [
    { r:"0–40",  c: scored.filter(a=>(a.match_score||0)<40).length,                                  fill:"rgba(244,114,182,0.55)" },
    { r:"40–55", c: scored.filter(a=>(a.match_score||0)>=40&&(a.match_score||0)<55).length,          fill:"rgba(244,114,182,0.75)" },
    { r:"55–70", c: scored.filter(a=>(a.match_score||0)>=55&&(a.match_score||0)<70).length,          fill:"rgba(167,139,250,0.75)" },
    { r:"70–85", c: scored.filter(a=>(a.match_score||0)>=70&&(a.match_score||0)<85).length,          fill:"rgba(34,211,238,0.75)" },
    { r:"85+",   c: scored.filter(a=>(a.match_score||0)>=85).length,                                 fill:"rgba(34,211,238,0.95)" },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
          <Brain size={22} className="text-white/40 animate-pulse" />
        </div>
        <p className="text-white/30 text-sm">{t("Loading candidates…")}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16 relative">
      {/* Atmospheric blobs */}
      <div className="blob-cyan    animate-blob-1 absolute -top-10 right-1/4"  style={{ width: 360, height: 360, opacity: 0.30 }} />
      <div className="blob-magenta animate-blob-2 absolute top-1/2 -left-20"   style={{ width: 340, height: 340, opacity: 0.25 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">

        {/* Back */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white mb-8 transition-colors group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          {t("Back to jobs")}
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
              {t("Applicants")}
            </p>
            <h1 className="text-3xl font-bold font-display text-white mb-1">{job?.title || t("Candidates")}</h1>
            <p className="text-white/40 text-sm">
              {job?.company}{job?.location && ` · ${job.location}`}
              {" · "}<span className="text-iridescent-soft font-semibold">{apps.length}</span> {t("applicants")}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              to={`/recruiter/jobs/${jobId}/stats`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.10] text-white/50 hover:text-white hover:bg-white/[0.05] text-sm transition-all"
            >
              <BarChart3 size={13} /> {t("Statistics")}
            </Link>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.10] text-white/50 hover:text-white hover:bg-white/[0.05] text-sm transition-all">
              <Download size={13} /> {t("Export")}
            </button>
            <button
              onClick={runScoring}
              disabled={scoring || apps.length === 0}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: scoring
                  ? "rgba(255,255,255,0.10)"
                  : "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)",
                color: scoring ? "#fff" : "#000",
              }}
            >
              {scoring
                ? <><Loader2 size={14} className="animate-spin" /> {t("Analyzing…")}</>
                : <><Brain size={14} /> {t("Run AI Analysis")}</>
              }
              {!scoring && apps.length > 0 && (
                <>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white animate-ping opacity-50" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scoring banner */}
        <AnimatePresence>
          {scoring && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-5 rounded-2xl border border-white/[0.10] flex items-center gap-4"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.20), rgba(167,139,250,0.20))" }}>
                <Brain size={22} className="text-iridescent-soft animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold mb-0.5">{t("AI Analysis in progress")}</p>
                <p className="text-white/45 text-sm">
                  Scoring {apps.length} applications — semantic matching, skill graphs, and generating personalized explanations…
                </p>
              </div>
              <div className="w-28 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full shimmer" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { v: apps.length,                                       l: "Total",             iridescent: false },
            { v: scored.length ? avgScore.toFixed(1)+"%" : "—",    l: "Avg Score",         iridescent: true  },
            { v: topScore ? topScore.toFixed(1)+"%" : "—",          l: "Top Score",         iridescent: true  },
            { v: counts.shortlisted + counts.hired,                  l: "Shortlisted/Hired", iridescent: false },
          ].map(({ v, l, iridescent }) => (
            <div key={l} className="rounded-2xl p-4" style={{ background: "var(--panel)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className={`text-2xl font-bold font-display mb-0.5 ${iridescent ? "text-iridescent-soft" : "text-white"}`}>{v}</div>
              <div className="text-xs text-white/35">{t(l)}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        {scored.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl border border-white/[0.08] p-5"
            style={{ background: "var(--panel)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-iridescent-soft" />
              <span className="text-sm font-bold text-iridescent-soft">{t("Score Distribution")}</span>
              <span className="text-xs text-white/30">({scored.length} scored)</span>
            </div>
            <ResponsiveContainer width="100%" height={85}>
              <BarChart data={chartData} margin={{ top:0, right:0, bottom:0, left:-22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="r" tick={{ fill:"rgba(255,255,255,0.30)", fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:"rgba(255,255,255,0.20)", fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background:"var(--panel-2)", border:"1px solid rgba(255,255,255,0.10)", borderRadius:12 }}
                  labelStyle={{ color:"rgba(255,255,255,0.4)", fontSize:12 }}
                  itemStyle={{ color:"#fff", fontSize:12 }}
                />
                <Bar dataKey="c" radius={[4,4,0,0]}>
                  {chartData.map((e,i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </motion.div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 relative z-10">
        {["all", ...STATUSES].map(s => {
          const isActive = filter === s;
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all capitalize border ${
                isActive ? "text-black border-transparent" : "text-white/45 hover:text-white border-white/[0.08]"
              }`}
              style={isActive
                ? { background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }
                : undefined
              }
            >
              {s === "all" ? `All (${apps.length})` : `${s} (${counts[s]||0})`}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl border border-white/[0.08] flex items-center justify-center mb-4"
            style={{ background: "rgba(255,255,255,0.03)" }}>
            <Users size={26} className="text-white/25" />
          </div>
          <p className="text-white/40 mb-1.5 font-semibold">
            {filter === "all" ? t("No candidates yet") : `${t("No candidates yet")}`}
          </p>
          {apps.length > 0 && !scored.length && filter === "all" && (
            <p className="text-xs text-white/30">Click "Run AI Analysis" to score and rank all applicants</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 relative z-10">
          {filtered.map((app, i) => {
            const rank    = apps.indexOf(app) + 1;
            const scored_ = app.match_score != null;
            const expl    = app.explanation;

            return (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4, ease: [0.22,1,0.36,1] }}
                onClick={() => navigate(`/recruiter/jobs/${jobId}/candidates/${app.id}`)}
                className="rounded-2xl border p-5 cursor-pointer transition-all duration-300 hover:bg-white/[0.02] hover:-translate-y-0.5"
                style={{
                  borderColor: rankBorderColor(rank, scored_),
                  background: "var(--panel)",
                }}
              >
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <RankBadge rank={rank} />

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
                    style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.85), rgba(167,139,250,0.85))" }}>
                    {app.candidate_name?.[0]?.toUpperCase() || "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{app.candidate_name}</p>
                    <p className="text-xs text-white/35 truncate">{app.candidate_email}</p>
                    {expl && (
                      <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5 block text-iridescent-soft">
                        <Sparkles size={9} className="inline mr-1 -mt-0.5" />
                        {t(expl.overall_label)}
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  {scored_ ? (
                    <div className="text-center shrink-0 mr-1">
                      <div className="text-3xl font-bold font-display text-iridescent-soft leading-none">
                        <AnimScore score={app.match_score!} />
                      </div>
                      <div className="text-[10px] text-white/25 mt-0.5">/ 100</div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/30 shrink-0 italic mr-1">Not scored</div>
                  )}

                  <StatusDropdown app={app} onChange={handleStatus} />

                  <Link
                    to={`/recruiter/jobs/${jobId}/candidates/${app.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-iridescent-soft border border-white/[0.10] hover:bg-white/[0.05] transition-all shrink-0"
                  >
                    Open <ArrowRight size={11} />
                  </Link>
                </div>

                {/* Quick skill pills */}
                {app.matched_skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 ml-[88px]">
                    {app.matched_skills.slice(0,5).map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md text-white/65 border border-white/[0.10]"
                        style={{ background: "rgba(34,211,238,0.06)" }}>{s}</span>
                    ))}
                    {app.missing_skills?.slice(0,3).map(s => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-md text-white/30 border border-white/[0.06]"
                        style={{ background: "rgba(244,114,182,0.03)" }}>{s}</span>
                    ))}
                    {app.matched_skills.length > 5 && (
                      <span className="text-[10px] px-1.5 py-0.5 text-white/25">+{app.matched_skills.length-5}</span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
