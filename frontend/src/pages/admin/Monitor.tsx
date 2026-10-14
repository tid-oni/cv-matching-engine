import { motion } from "motion/react";
import { useI18n } from "../../context/I18nContext";
import {
  Brain, TrendingUp, Zap, Database, Cpu, Award,
  Activity, Layers,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

const trainingLoss = [
  { step: 0,    loss: 0.673 },
  { step: 200,  loss: 0.541 },
  { step: 400,  loss: 0.432 },
  { step: 600,  loss: 0.345 },
  { step: 800,  loss: 0.279 },
  { step: 1000, loss: 0.236 },
  { step: 1200, loss: 0.212 },
  { step: 1400, loss: 0.196 },
  { step: 1600, loss: 0.185 },
  { step: 1733, loss: 0.180 },
];

const correlationProgress = [
  { epoch: "Pre-train", spearman: 0.233, pearson: 0.216 },
  { epoch: "Epoch 1",   spearman: 0.512, pearson: 0.498 },
  { epoch: "Epoch 2",   spearman: 0.698, pearson: 0.714 },
  { epoch: "Epoch 3",   spearman: 0.793, pearson: 0.812 },
  { epoch: "Final",     spearman: 0.817, pearson: 0.836 },
];

const radarData = [
  { metric: "Spearman", score: 81.7 },
  { metric: "Pearson",  score: 83.6 },
  { metric: "Accuracy", score: 87.2 },
  { metric: "Recall",   score: 79.4 },
  { metric: "F1",       score: 83.1 },
];

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2 text-xs" style={{ background: "#0a0a0a" }}>
      <p className="text-white/30 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminMonitor() {
  const { t } = useI18n();
  const metrics = [
    {
      label: "Spearman ρ",
      value: "0.817",
      prev: "0.233",
      gain: "+250.9%",
      icon: TrendingUp,
      opacity: 1,
      desc: "Rank correlation with human labels",
    },
    {
      label: "Pearson r",
      value: "0.836",
      prev: "0.216",
      gain: "+287.7%",
      icon: Activity,
      opacity: 0.85,
      desc: "Linear correlation coefficient",
    },
    {
      label: "Final Loss",
      value: "0.180",
      prev: "0.673",
      gain: "−73.2%",
      icon: Zap,
      opacity: 0.7,
      desc: "Cosine + MNR combined loss",
    },
    {
      label: "Training Pairs",
      value: "8,733",
      prev: "—",
      gain: "CV + Job pairs",
      icon: Database,
      opacity: 0.55,
      desc: "Curated dataset samples",
    },
  ];

  const config = [
    { label: "Base Model",      value: "BAAI/bge-base-en-v1.5" },
    { label: "Embedding Dim",   value: "768" },
    { label: "Architecture",    value: "BERT-base" },
    { label: "Loss Functions",  value: "CosineSimilarity + MNR" },
    { label: "Epochs",          value: "3" },
    { label: "Batch Size",      value: "16" },
    { label: "Learning Rate",   value: "2e-5" },
    { label: "Warmup Ratio",    value: "0.1" },
    { label: "Save Strategy",   value: "Steps (200)" },
    { label: "Optimizer",       value: "AdamW" },
    { label: "Mixed Precision", value: "fp16" },
    { label: "Max Seq Length",  value: "512 tokens" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-12 relative">
      <div className="blob-cyan    animate-blob-1 absolute -top-10 -left-10"  style={{ width: 340, height: 340, opacity: 0.20 }} />
      <div className="blob-violet  animate-blob-2 absolute top-1/3 -right-20" style={{ width: 320, height: 320, opacity: 0.18 }} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-iridescent-soft mb-1">
              {t("Admin · AI Engine")}
            </p>
            <h1 className="text-3xl font-bold font-display text-white mb-1">{t("AI Model Monitor")}</h1>
            <p className="text-white/40 text-sm">Fine-tuned NLP matching engine performance</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.10] text-iridescent-soft text-sm font-medium"
            style={{ background: "rgba(34,211,238,0.06)" }}>
            <div className="w-1.5 h-1.5 rounded-full pulse-glow" style={{ background: "#22d3ee", color: "#22d3ee" }} />
            {t("Model Active")}
          </div>
        </div>
      </motion.div>

      {/* Model info banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 p-4 rounded-xl border border-white/8 bg-white/[0.03] flex items-center gap-4"
      >
        <div className="w-12 h-12 rounded-xl bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0">
          <Brain size={22} className="text-white/70" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">cv-matcher-finetuned</p>
          <p className="text-xs text-white/35 mt-0.5">
            Fine-tuned on <span className="text-white/60">BAAI/bge-base-en-v1.5</span> ·
            Saved at <code className="text-white/50 bg-white/[0.06] px-1 rounded">app/models/cv-matcher-finetuned/</code>
          </p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-white/30">Trained</div>
          <div className="text-sm text-white font-medium">2025 · 1733 steps</div>
        </div>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map(({ label, value, prev, gain, icon: Icon, opacity, desc }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="rounded-2xl border border-white/[0.06] p-5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mb-3">
              <Icon size={16} className="text-white/50" />
            </div>
            <div className="text-2xl font-bold text-white" style={{ opacity }}>{value}</div>
            <div className="text-xs font-medium text-white/40 mt-0.5">{label}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs font-semibold ${gain.startsWith("+") || gain.startsWith("−") ? "text-white/70" : "text-white/40"}`}>
                {gain}
              </span>
              {prev !== "—" && <span className="text-xs text-white/25">from {prev}</span>}
            </div>
            <div className="text-xs text-white/20 mt-1">{desc}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        {/* Loss curve */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Zap size={14} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Training Loss Curve</h2>
            <span className="ml-auto text-xs text-white/25">0.673 → 0.180</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trainingLoss}>
              <XAxis
                dataKey="step"
                tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "Steps", position: "insideBottom", offset: -2, fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0.1, 0.7]}
                width={36}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="loss"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "rgba(255,255,255,0.9)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Correlation progress */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={14} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Correlation Progression</h2>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={correlationProgress}>
              <XAxis
                dataKey="epoch"
                tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 1]}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="spearman"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={2.5}
                dot={false}
                name="Spearman"
              />
              <Line
                type="monotone"
                dataKey="pearson"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={2.5}
                dot={false}
                name="Pearson"
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-white/35">
              <div className="w-3 h-0.5 bg-white/85 rounded" /> Spearman
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/35">
              <div className="w-3 h-0.5 bg-white/45 rounded" /> Pearson
            </div>
          </div>
        </motion.div>
      </div>

      {/* Radar + config */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Radar chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Award size={14} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Performance Radar</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke="rgba(255,255,255,0.7)"
                fill="rgba(255,255,255,0.12)"
                fillOpacity={1}
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Training config */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl border border-white/[0.05] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Cpu size={14} className="text-white/40" />
            <h2 className="font-semibold text-white text-sm">Training Configuration</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            {config.map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-white/25 uppercase tracking-wider">{label}</p>
                <p className="text-xs text-white font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={12} className="text-white/30" />
              <span className="text-xs text-white/40 font-medium">Pipeline Components</span>
            </div>
            <div className="space-y-1.5">
              {[
                { name: "Semantic Similarity", weight: "60%", opacity: 0.9 },
                { name: "Skill Graph (TF-IDF)", weight: "25%", opacity: 0.65 },
                { name: "Experience Boost",     weight: "10%", opacity: 0.45 },
                { name: "URL / Portfolio",      weight: "5%",  opacity: 0.3 },
              ].map(({ name, weight, opacity }) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-white/40">{name}</span>
                      <span className="text-white/25">{weight}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06]">
                      <div
                        className="h-1 rounded-full bg-white"
                        style={{ width: weight, opacity }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}