import { motion } from "motion/react";

interface Props {
  score: number;  // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function getColor(score: number) {
  if (score >= 70) return "#10b981";
  if (score >= 45) return "#f59e0b";
  return "#ef4444";
}

function getLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Partial";
  if (score >= 25) return "Weak";
  return "Poor";
}

export default function ScoreRing({ score, size = 80, strokeWidth = 7, label }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white leading-none" style={{ color }}>
            {Math.round(score)}
          </span>
          <span className="text-[9px] text-slate-400 leading-none mt-0.5">/ 100</span>
        </div>
      </div>
      {label !== undefined ? (
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      ) : (
        <span className="text-xs font-medium" style={{ color }}>{getLabel(score)}</span>
      )}
    </div>
  );
}
