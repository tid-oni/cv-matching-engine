import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart3, Zap, AlertCircle, RefreshCw, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { matchingClient } from "@/api/client";
import { ScoreCard } from "@/components/ui/score-card";
import { SkillsPanel } from "@/components/ui/skills-panel";
import { MetalButton } from "@/components/ui/metal-button";

const SAMPLE_JOB = `Senior Python Backend Engineer

Requirements:
- 5+ years Python experience
- FastAPI or Django REST framework
- PostgreSQL or MySQL database expertise
- Docker and Kubernetes knowledge
- AWS or GCP cloud experience
`;

const SAMPLE_CVS = `John Smith
Senior Backend Engineer | Python, FastAPI, PostgreSQL, Docker, AWS, Kubernetes. 8 years exp.
---
Jane Doe
Junior Frontend Developer | HTML, CSS, JavaScript, React. 2 years experience.
---
Ahmed Ben Ali
DevOps Engineer | Docker, Kubernetes, AWS, Terraform, Python, CI/CD. 6 years experience.
---
Maria Garcia
Full Stack Developer | Python, Django, PostgreSQL, Vue.js, Docker. 4 years experience.`;

interface BatchEntry {
  rank:                  number;
  cv_index:              number;
  cv_preview:            string;
  total_score:           number;
  semantic_score:        number;
  skill_proximity_score: number;
  tfidf_score:           number;
  url_boost:             number;
  matched_skills:        string[];
  missing_skills:        string[];
  partial_skills:        string[];
  error?:                string;
}

function ScoreLabel({ score }: { score: number }) {
  const { text, opacity } =
    score >= 85 ? { text: "Excellent", opacity: "text-white" } :
    score >= 70 ? { text: "Strong",    opacity: "text-white/70" } :
    score >= 50 ? { text: "Moderate",  opacity: "text-white/50" } :
                  { text: "Weak",      opacity: "text-white/30" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] ${opacity}`}>
      {text}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const v =
    rank === 1 ? "gold" :
    rank === 2 ? "silver" :
    rank === 3 ? "default" : null;

  if (v) {
    const gradients: Record<string, string> = {
      gold:    "linear-gradient(135deg,#FFEBA1,#9B873F)",
      silver:  "linear-gradient(135deg,#d0d0d0,#999)",
      default: "linear-gradient(135deg,#B9B9B9,#969696)",
    };
    const medals = ["", "🥇", "🥈", "🥉"];
    return (
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: gradients[v] }}
      >
        {medals[rank]}
      </div>
    );
  }

  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white/50 shrink-0 bg-white/[0.06] border border-white/[0.08]">
      {rank}
    </div>
  );
}

export default function Batch() {
  const [jobText, setJobText]   = useState(SAMPLE_JOB);
  const [cvInput, setCvInput]   = useState(SAMPLE_CVS);
  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<BatchEntry[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const parseCVs = (): string[] =>
    cvInput.includes("---")
      ? cvInput.split("---").map((s) => s.trim()).filter(Boolean)
      : cvInput.split(/\n\n\n+/).map((s) => s.trim()).filter(Boolean);

  const handleBatch = async () => {
    const cvs = parseCVs();
    if (!jobText.trim()) { setError("Please provide a job description."); return; }
    if (cvs.length === 0) { setError("Please provide at least one CV."); return; }
    setError(null);
    setLoading(true);
    try {
      const res  = await matchingClient.post("/match/batch", { cvs, job_text: jobText });
      const data = res.data;
      setResults(Array.isArray(data) ? data : (data.results ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "API call failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const cvCount = parseCVs().length;

  return (
    <div className="min-h-screen bg-[#000] text-white pt-20 pb-16">
      <div className="relative z-10 max-w-6xl mx-auto px-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] mb-5">
            <BarChart3 size={12} className="text-white/60" />
            <span className="text-xs font-semibold text-white/50 tracking-wide">BATCH RANKING</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
              Rank Multiple
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white/80 to-white/50">
              Candidates at Once
            </span>
          </h1>
          <p className="text-white/35 text-lg max-w-xl mx-auto">
            Paste CVs separated by <code className="text-white/60 text-sm font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">---</code>. Scores and ranks all of them in seconds.
          </p>
        </motion.div>

        {/* Inputs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="grid lg:grid-cols-5 gap-6 mb-6"
        >
          {/* CVs */}
          <div className="lg:col-span-3 rounded-3xl p-6 flex flex-col gap-4 border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={15} className="text-white/40" />
                <span className="font-semibold text-sm text-white">CV List</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.08]">
                {cvCount} CV{cvCount !== 1 ? "s" : ""} detected
              </span>
            </div>
            <textarea
              value={cvInput}
              onChange={(e) => setCvInput(e.target.value)}
              className="flex-1 min-h-[320px] bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-sm text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors font-mono"
              placeholder={"CV 1 text\n---\nCV 2 text\n---\nCV 3 text"}
            />
          </div>

          {/* JD */}
          <div className="lg:col-span-2 rounded-3xl p-6 flex flex-col gap-4 border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-white/40" />
              <span className="font-semibold text-sm text-white">Job Description</span>
            </div>
            <textarea
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="flex-1 min-h-[320px] bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-sm text-white/70 placeholder-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors font-mono"
              placeholder="Paste job description here…"
            />
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 mb-6 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white/50 text-sm"
          >
            <AlertCircle size={15} className="shrink-0 text-white/30" />
            {error}
          </motion.div>
        )}

        {/* CTA */}
        <div className="flex justify-center mb-16">
          <MetalButton
            onClick={handleBatch}
            disabled={loading}
            className="h-12 px-10 text-sm gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><RefreshCw size={15} className="animate-spin" /> Ranking {cvCount} CVs…</>
            ) : (
              <><Trophy size={15} /> Rank All CVs</>
            )}
          </MetalButton>
        </div>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Total Ranked",  val: results.length.toString() },
                  { label: "Top Score",     val: `${results[0]?.total_score.toFixed(1) ?? 0}` },
                  { label: "Avg Score",     val: `${(results.reduce((s, r) => s + r.total_score, 0) / results.length).toFixed(1)}` },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-2xl p-4 text-center bg-white/[0.03] border border-white/[0.07]">
                    <div className="text-2xl font-bold font-mono text-white mb-0.5">{val}</div>
                    <div className="text-xs text-white/30">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-xs font-semibold text-white/25 tracking-wide uppercase">Ranked Results</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              <div className="space-y-3">
                {results.map((r) => (
                  <motion.div
                    key={r.cv_index}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: r.rank * 0.05 }}
                  >
                    <div
                      onClick={() => setExpanded(expanded === r.cv_index ? null : r.cv_index)}
                      className="rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all duration-200 border border-white/[0.07] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04]"
                    >
                      <RankBadge rank={r.rank} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {r.cv_preview || `Candidate #${r.cv_index + 1}`}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {r.matched_skills.slice(0, 5).map((s) => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.07] text-white/50 border border-white/[0.08]">
                              {s}
                            </span>
                          ))}
                          {r.matched_skills.length > 5 && (
                            <span className="text-[10px] text-white/25">+{r.matched_skills.length - 5}</span>
                          )}
                        </div>
                      </div>
                      <ScoreLabel score={r.total_score} />
                      <div className="text-lg font-bold font-mono text-white/80 tabular-nums">
                        {r.total_score.toFixed(1)}
                      </div>
                      {expanded === r.cv_index
                        ? <ChevronUp size={14} className="text-white/30 shrink-0" />
                        : <ChevronDown size={14} className="text-white/30 shrink-0" />
                      }
                    </div>

                    <AnimatePresence>
                      {expanded === r.cv_index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="grid md:grid-cols-2 gap-4 mt-2 pt-2">
                            <ScoreCard
                              score={r.total_score}
                              semanticScore={r.semantic_score}
                              skillScore={r.skill_proximity_score}
                              tfidfScore={r.tfidf_score}
                              urlBoost={r.url_boost}
                            />
                            <SkillsPanel
                              matched={r.matched_skills}
                              missing={r.missing_skills}
                              partial={r.partial_skills}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}