import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence, animate } from "motion/react";
import { Sparkles, Zap, Loader2, RotateCcw, Brain, AlertCircle, Check } from "lucide-react";
import { matchText, type LiveMatchResult } from "@/api/platform";
import { MetalButton } from "@/components/ui/metal-button";
import { WebGLShader } from "@/components/ui/web-gl-shader";

/* ── lazy-mounted shader (matches landing pattern) ──────────────── */
function InViewOnly({ children, rootMargin = "200px" }: { children: ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setMounted(e.isIntersecting), { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none">
      {mounted ? children : null}
    </div>
  );
}

/* normalize a sub-score that may arrive as 0..1 or 0..100 */
const pct = (v: number | undefined | null) =>
  v == null ? 0 : v <= 1 ? Math.round(v * 1000) / 10 : Math.round(v * 10) / 10;

/* ── Example seeds so the jury can run it in one click ──────────── */
const EXAMPLE_CV =
  `Senior Backend Engineer with 6 years building production Python services.
Designed and shipped REST + gRPC APIs with FastAPI and Flask. Strong PostgreSQL
data modeling, Redis caching, and async pipelines. Containerized with Docker and
deployed on AWS (ECS, RDS, Lambda). Built CI/CD with GitHub Actions. Comfortable
with observability (Prometheus, Grafana) and writing tests with pytest.`;

const EXAMPLE_JD =
  `We are hiring a Backend Engineer to design and ship REST and gRPC services that
power our SaaS platform. You will own high-throughput Python services, PostgreSQL
data models, Redis caches, and async pipelines. Experience with Docker and a cloud
provider (AWS preferred) is required. Strong testing and observability culture.`;

function ScoreRing({ score }: { score: number }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    from.current = score;
    const c = animate(start, score, {
      duration: 1.6, ease: "easeOut",
      onUpdate: (n) => setV(parseFloat(n.toFixed(1))),
    });
    return c.stop;
  }, [score]);
  const R = 58;
  const C = 2 * Math.PI * R;
  const offset = C - (C * Math.min(v, 100)) / 100;
  return (
    <div className="relative w-40 h-40 shrink-0">
      <svg viewBox="0 0 144 144" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="liveRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <circle cx="72" cy="72" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="9" />
        <motion.circle cx="72" cy="72" r={R} fill="none" stroke="url(#liveRing)" strokeWidth="11"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          style={{ filter: "blur(7px)", opacity: 0.4 }} />
        <motion.circle cx="72" cy="72" r={R} fill="none" stroke="url(#liveRing)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold font-display text-iridescent-soft">{v.toFixed(1)}</span>
        <span className="text-[10px] text-white/35 mt-0.5 tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

function SubBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-white/55 font-medium">{label}</span>
        <span className="text-xs font-bold font-mono text-iridescent-soft">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-full rounded-full"
          style={{ background: "linear-gradient(90deg, #22d3ee, #a78bfa)" }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 0.15 }} />
      </div>
    </div>
  );
}

export function LiveMatch() {
  const [cv, setCv]   = useState(EXAMPLE_CV);
  const [jd, setJd]   = useState(EXAMPLE_JD);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<LiveMatchResult | null>(null);

  const run = async () => {
    if (!cv.trim() || !jd.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await matchText(cv, jd);
      setResult(data);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(
        status === 503
          ? "The model is still warming up — give it a few seconds and try again."
          : "Couldn't reach the matching engine. Make sure the API is running on :8000."
      );
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setCv(EXAMPLE_CV); setJd(EXAMPLE_JD); setResult(null); setError(null); };

  const score    = pct(result?.score ?? result?.total_score);
  const semantic = pct(result?.semantic_score);
  const skill    = pct(result?.skill_proximity_score ?? result?.skill_score);
  const tfidf    = pct(result?.tfidf_score);
  const matched  = result?.matched_skills ?? [];
  const missing  = result?.missing_skills ?? [];

  // Clean, derived verdict (the engine's raw explanation is emoji/Streamlit-formatted)
  const verdict =
    score >= 80 ? `Exceptional match — the profile aligns strongly across ${matched.length} key skills and high semantic overlap.`
    : score >= 65 ? `Strong match — solid alignment with the role, covering ${matched.length} required skills.`
    : score >= 50 ? `Moderate match — real overlap, with ${missing.length || "a few"} area${missing.length === 1 ? "" : "s"} to strengthen.`
    : score >= 35 ? `Limited match — some relevant signal, but meaningful skill gaps remain.`
    : `Weak match — this role needs experience the CV doesn't yet demonstrate.`;

  return (
    <section className="relative z-10 py-28 px-4 bg-[#000] overflow-hidden">
      <InViewOnly>
        <div className="w-full h-full" style={{ opacity: 0.05, mixBlendMode: "screen" as const }}>
          <WebGLShader />
        </div>
      </InViewOnly>

      {/* atmosphere */}
      <div className="blob-cyan    animate-blob-1 absolute -top-20 left-[8%]"   style={{ width: 420, height: 420, opacity: 0.32 }} />
      <div className="blob-magenta animate-blob-2 absolute -bottom-24 right-[8%]" style={{ width: 400, height: 400, opacity: 0.3 }} />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 75% at 50% 45%, transparent 18%, rgba(0,0,0,0.8) 70%, #000 100%)" }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* header */}
        <div className="text-center mb-10">
          <p className="gs-reveal text-[10px] font-semibold tracking-[0.22em] text-white/22 uppercase mb-5">
            Try it live · Real model
          </p>
          <h2 className="gs-heading text-4xl sm:text-5xl font-bold font-display text-white tracking-tight leading-[1]">
            Score a match<br />in real time
          </h2>
          <p className="gs-reveal text-white/30 text-sm sm:text-base max-w-xl mx-auto mt-5 leading-relaxed">
            This runs the actual fine-tuned engine — not a mockup. Paste a CV and a job
            description, hit match, and see the live score, sub-signals, and skill gaps.
          </p>
        </div>

        {/* playground card */}
        <div
          className="gs-reveal rounded-3xl border border-white/[0.08] p-5 sm:p-7"
          style={{ background: "rgba(10,14,26,0.78)" }}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2 block">CV / Résumé</label>
              <textarea
                value={cv}
                onChange={(e) => setCv(e.target.value)}
                rows={8}
                spellCheck={false}
                className="field text-sm resize-none w-full leading-relaxed"
                placeholder="Paste a candidate CV…"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2 block">Job Description</label>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows={8}
                spellCheck={false}
                className="field text-sm resize-none w-full leading-relaxed"
                placeholder="Paste a job description…"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button onClick={run} disabled={loading} className="relative group inline-block disabled:opacity-50">
              <span className="btn-halo" />
              <MetalButton className="relative h-11 px-8 text-sm gap-2">
                {loading ? <><Loader2 size={14} className="animate-spin" /> Scoring…</> : <><Zap size={14} /> Run match</>}
              </MetalButton>
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
            >
              <RotateCcw size={12} /> Reset to example
            </button>
            <span className="ml-auto text-[11px] text-white/25 flex items-center gap-1.5">
              <Brain size={11} className="text-iridescent-soft" /> BAAI/bge · fine-tuned
            </span>
          </div>

          {/* error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-white/[0.08]"
                style={{ background: "rgba(244,114,182,0.05)" }}
              >
                <AlertCircle size={14} className="text-white/50 mt-0.5 shrink-0" />
                <p className="text-xs text-white/55 leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* result */}
          <AnimatePresence>
            {result && !error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-col md:flex-row gap-7">
                  {/* ring + subscores */}
                  <div className="flex items-center gap-6 shrink-0">
                    <ScoreRing score={score} />
                    <div className="space-y-3 min-w-[150px]">
                      {semantic > 0 && <SubBar label="Semantic"   value={semantic} />}
                      {skill    > 0 && <SubBar label="Skill graph" value={skill} />}
                      {tfidf    > 0 && <SubBar label="Lexical"     value={tfidf} />}
                    </div>
                  </div>

                  {/* verdict + skills */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2.5 mb-4">
                      <Sparkles size={14} className="text-iridescent-soft mt-0.5 shrink-0" />
                      <p className="text-sm text-white/65 leading-relaxed">{verdict}</p>
                    </div>
                    {matched.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-iridescent-soft mb-2">
                          Matched ({matched.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {matched.slice(0, 14).map((s) => (
                            <span key={s} className="text-[11px] px-2 py-0.5 rounded-md text-white/70 border border-white/[0.1]"
                              style={{ background: "rgba(34,211,238,0.07)" }}>
                              <Check size={9} className="inline mr-1 -mt-0.5 text-iridescent-soft" />{s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {missing.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 mb-2">
                          Missing ({missing.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {missing.slice(0, 10).map((s) => (
                            <span key={s} className="text-[11px] px-2 py-0.5 rounded-md text-white/40 border border-white/[0.06]"
                              style={{ background: "rgba(244,114,182,0.04)" }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
