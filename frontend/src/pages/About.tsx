import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";
import { Brain, BarChart3, Activity, Cpu, Database, GitBranch, Globe, RefreshCw } from "lucide-react";
import { matchingClient } from "@/api/client";
import { MetalButton } from "@/components/ui/metal-button";

interface HealthData {
  status:         string;
  models_loaded:  string[];
  model_used:     string;
  uptime_seconds: number;
}

interface MetricsData {
  total_matches?:  number;
  matches_total?:  number;
  [key: string]:   unknown;
}

function MetricRow({ label, baseline, finetuned }: { label: string; baseline: number; finetuned: number }) {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const delta  = ((finetuned - baseline) / baseline * 100).toFixed(1);

  return (
    <div ref={ref} className="grid grid-cols-4 gap-4 py-3 border-b border-white/[0.05] items-center">
      <div className="text-sm text-white/40">{label}</div>
      <div className="text-right">
        <span className="text-sm font-mono text-white/25">{baseline.toFixed(2)}</span>
      </div>
      <div className="text-right">
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden mb-1">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={{ width: 0 }}
            animate={inView ? { width: `${finetuned * 100}%` } : {}}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
            style={{ opacity: 0.4 + finetuned * 0.5 }}
          />
        </div>
        <span className="text-sm font-mono font-bold text-white">{finetuned.toFixed(2)}</span>
      </div>
      <div className="text-right">
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/[0.07] text-white/60 border border-white/[0.1]">
          +{delta}%
        </span>
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function UptimeStr(seconds: number) {
  if (seconds > 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds > 60)   return `${(seconds / 60).toFixed(0)}m`;
  return `${Math.round(seconds)}s`;
}

export default function About() {
  const [health, setHealth]   = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [h, m] = await Promise.allSettled([
        matchingClient.get("/health"),
        matchingClient.get("/metrics"),
      ]);
      if (h.status === "fulfilled") setHealth(h.value.data);
      if (m.status === "fulfilled") setMetrics(m.value.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchStatus(); }, []);

  const isOnline     = health?.status && health.status !== "offline";
  const totalMatches = metrics
    ? ((metrics.total_matches ?? metrics.matches_total ?? 0) as number)
    : 0;

  return (
    <div className="min-h-screen bg-[#000] text-white pt-20 pb-16">
      <div className="relative z-10 max-w-5xl mx-auto px-4">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] mb-5">
            <Cpu size={12} className="text-white/50" />
            <span className="text-xs font-semibold text-white/40 tracking-wide">MODEL & SYSTEM INFO</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold font-display mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
              Under the Hood
            </span>
          </h1>
          <p className="text-white/35 text-lg max-w-xl mx-auto">
            Fine-tuned embeddings, skill ontology, and real-time scoring metrics.
          </p>
        </motion.div>

        {/* Live status */}
        <Reveal className="mb-10">
          <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isOnline ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" : "bg-white/20"}`} />
                <span className="font-semibold text-sm text-white">Live API Status</span>
              </div>
              <MetalButton
                onClick={fetchStatus}
                disabled={loading}
                className="h-8 px-4 text-xs gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                Refresh
              </MetalButton>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "API Status",    val: isOnline ? "ONLINE"  : "OFFLINE",  icon: Activity },
                { label: "Models Loaded", val: health ? health.models_loaded.length.toString() : "—", icon: Brain },
                { label: "Uptime",        val: health ? UptimeStr(health.uptime_seconds) : "—",       icon: Cpu },
                { label: "Total Matches", val: totalMatches > 0 ? totalMatches.toString() : "—",      icon: BarChart3 },
              ].map(({ label, val, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-4 text-center bg-white/[0.04] border border-white/[0.07]">
                  <Icon size={16} className="mx-auto mb-2 text-white/40" />
                  <div className="text-xl font-bold font-mono text-white mb-0.5">{val}</div>
                  <div className="text-xs text-white/30">{label}</div>
                </div>
              ))}
            </div>

            {health?.models_loaded && health.models_loaded.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/[0.05]">
                <p className="text-xs text-white/25 mb-2 font-medium uppercase tracking-wider">Loaded Models</p>
                <div className="flex flex-wrap gap-2">
                  {health.models_loaded.map((m) => (
                    <span key={m} className="text-xs px-2.5 py-1 rounded-full bg-white/[0.05] text-white/50 border border-white/[0.08] font-mono">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Reveal>

        {/* Eval metrics */}
        <Reveal delay={0.05} className="mb-10">
          <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 size={16} className="text-white/40" />
              <h2 className="font-semibold text-white">Baseline vs Fine-Tuned</h2>
            </div>
            <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-white/25 mb-2 uppercase tracking-wide">
              <div>Metric</div>
              <div className="text-right">Baseline</div>
              <div className="text-right">Fine-Tuned</div>
              <div className="text-right">Δ Gain</div>
            </div>
            <MetricRow label="Spearman ρ"  baseline={0.62} finetuned={0.78} />
            <MetricRow label="Pearson r"   baseline={0.58} finetuned={0.75} />
            <MetricRow label="NDCG@5"      baseline={0.68} finetuned={0.82} />
            <MetricRow label="NDCG@10"     baseline={0.71} finetuned={0.85} />
            <MetricRow label="MRR"         baseline={0.68} finetuned={0.82} />
          </div>
        </Reveal>

        {/* Architecture */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Reveal>
            <div className="rounded-3xl p-6 h-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-5">
                <Brain size={15} className="text-white/40" />
                <h3 className="font-semibold text-white text-sm">Fine-Tuning Setup</h3>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Base Model",     val: "BAAI/bge-large-en-v1.5" },
                  { label: "Multilingual",   val: "BAAI/bge-m3" },
                  { label: "Training Pairs", val: "9,031 CV-JD pairs" },
                  { label: "Train / Eval",   val: "7,224 / 1,807" },
                  { label: "Optimizer",      val: "AdamW · lr=2e-5 · wd=0.01" },
                  { label: "Batch Size",     val: "16 · 3 epochs" },
                  { label: "Loss",           val: "CosineSimilarityLoss + MNR" },
                  { label: "Train Time",     val: "~45 min on GPU" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-white/30 shrink-0">{label}</span>
                    <span className="text-white/70 font-mono text-xs text-right">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.07}>
            <div className="rounded-3xl p-6 h-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={15} className="text-white/40" />
                <h3 className="font-semibold text-white text-sm">Scoring Formula</h3>
              </div>
              <div className="font-mono text-xs text-white/50 bg-white/[0.04] rounded-xl p-4 mb-5 leading-relaxed">
                score = semantic × <span className="text-white">0.40</span><br />
                      + skill_graph × <span className="text-white">0.30</span><br />
                      + tf_idf × <span className="text-white">0.15</span><br />
                      + url_boost <span className="text-white/60">(≤15 pts)</span>
              </div>
              <div className="space-y-2">
                {[
                  { icon: Brain,     label: "Semantic",    desc: "Fine-tuned BGE cosine sim" },
                  { icon: Database,  label: "Skill Graph", desc: "150+ skills, 11 clusters" },
                  { icon: BarChart3, label: "TF-IDF",      desc: "Lexical backstop, bigrams" },
                  { icon: GitBranch, label: "URL Boost",   desc: "GitHub / LinkedIn / Portfolio" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3 text-xs">
                    <Icon size={12} className="text-white/50" />
                    <span className="font-semibold text-white/70">{label}</span>
                    <span className="text-white/30">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Skill graph */}
        <Reveal delay={0.1} className="mb-10">
          <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-5">
              <GitBranch size={15} className="text-white/40" />
              <h2 className="font-semibold text-white">Skill Proximity Graph</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              {[
                { label: "Total Skills", val: "150+" },
                { label: "Clusters",     val: "11" },
                { label: "Sub-clusters", val: "28" },
                { label: "Cross-links",  val: "40+" },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-2xl p-3 text-center bg-white/[0.04] border border-white/[0.07]">
                  <div className="text-2xl font-bold text-white">{val}</div>
                  <div className="text-xs text-white/30 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { tier: "Exact Match",   sim: "1.0",       desc: "Same canonical skill" },
                { tier: "Sub-Cluster",   sim: "0.65–0.85", desc: "React ↔ Vue, MySQL ↔ PostgreSQL" },
                { tier: "Same Cluster",  sim: "0.25–0.65", desc: "Frontend ↔ JS Frameworks" },
                { tier: "Cross-Cluster", sim: "0.0–0.25",  desc: "DevOps ↔ Backend (Docker→FastAPI)" },
              ].map(({ tier, sim, desc }) => (
                <div key={tier} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="font-mono text-xs text-white/50 shrink-0 mt-0.5">{sim}</span>
                  <div>
                    <div className="font-medium text-white text-sm">{tier}</div>
                    <div className="text-white/30 text-xs mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Datasets */}
        <Reveal delay={0.12}>
          <div className="rounded-3xl p-6 bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-5">
              <Globe size={15} className="text-white/40" />
              <h2 className="font-semibold text-white">Training Datasets</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/25 uppercase tracking-wide border-b border-white/[0.05]">
                    <th className="pb-3 pr-4">Dataset</th>
                    <th className="pb-3 pr-4">Pairs</th>
                    <th className="pb-3 pr-4">Label Type</th>
                    <th className="pb-3">Normalized</th>
                  </tr>
                </thead>
                <tbody className="text-white/50">
                  {[
                    { name: "cnamuangtoun/resume-job-description-fit", pairs: "8,000", label: "Binary 0/1",  norm: "Float 0.0–1.0" },
                    { name: "netsol/resume-score-details",             pairs: "1,031", label: "Score 1–10",  norm: "Float 0.0–1.0" },
                    { name: "Combined",                                pairs: "9,031", label: "Float",       norm: "7,224 train / 1,807 eval", bold: true },
                  ].map(({ name, pairs, label, norm, bold }) => (
                    <tr key={name} className={`border-b border-white/[0.04] ${bold ? "font-semibold text-white" : ""}`}>
                      <td className="py-3 pr-4 font-mono text-xs text-white/35 max-w-[200px] truncate">{name}</td>
                      <td className="py-3 pr-4 text-right font-mono">{pairs}</td>
                      <td className="py-3 pr-4">{label}</td>
                      <td className="py-3 text-white/50 text-xs">{norm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}