import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  score:        number;
  semanticScore: number;
  skillScore:   number;
  tfidfScore:   number;
  urlBoost:     number;
  className?:   string;
}

function ScoreLabel({ score }: { score: number }) {
  const { text, opacity } =
    score >= 85 ? { text: "Excellent", opacity: "text-white" } :
    score >= 70 ? { text: "Strong",    opacity: "text-white/80" } :
    score >= 50 ? { text: "Moderate",  opacity: "text-white/55" } :
                  { text: "Weak",      opacity: "text-white/35" };
  return (
    <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/[0.12] bg-white/[0.06]", opacity)}>
      {text}
    </span>
  );
}

function useCountUp(target: number, duration = 1.4) {
  const [value, setValue] = useState(0);
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    const start = performance.now();
    const tick  = (now: number) => {
      const t    = Math.min((now - start) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function RadialGauge({ score }: { score: number }) {
  const count = useCountUp(score);
  const r     = 54;
  const circ  = Math.PI * r;
  const arc   = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-40 h-24 mx-auto">
      <svg width="160" height="100" viewBox="0 0 160 100" className="overflow-visible">
        <path d={`M 16 88 A ${r} ${r} 0 0 1 144 88`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeLinecap="round" />
        <motion.path
          d={`M 16 88 A ${r} ${r} 0 0 1 144 88`}
          fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - arc }}
          transition={{ duration: 1.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </svg>
      <div className="absolute bottom-0 inset-x-0 text-center">
        <div className="text-3xl font-bold font-mono text-white leading-none">{count}</div>
        <div className="text-[10px] text-white/30 mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

export function ScoreCard({ score, semanticScore, skillScore, tfidfScore, urlBoost, className }: ScoreCardProps) {
  const bars = [
    { label: "Semantic",  val: semanticScore, weight: "40%" },
    { label: "Skill",     val: skillScore,    weight: "30%" },
    { label: "TF-IDF",    val: tfidfScore,    weight: "15%" },
    { label: "URL Boost", val: urlBoost,      weight: "≤15" },
  ];

  return (
    <div className={cn("rounded-3xl p-6 bg-white/[0.03] border border-white/[0.07] backdrop-blur-sm", className)}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-semibold text-white/30 tracking-widest uppercase">Score</span>
        <ScoreLabel score={score} />
      </div>

      <RadialGauge score={score} />

      <div className="mt-6 space-y-3">
        {bars.map(({ label, val, weight }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-white/40">{label}</span>
              <span className="text-white/70 font-mono font-semibold">
                {label === "URL Boost" ? `+${val.toFixed(1)}` : val.toFixed(1)}
                <span className="text-white/25 ml-1">({weight})</span>
              </span>
            </div>
            <div className="h-0.5 rounded-full bg-white/[0.07] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${label === "URL Boost" ? (val / 15) * 100 : val}%` }}
                transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ opacity: 0.5 + (val / 100) * 0.5 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}