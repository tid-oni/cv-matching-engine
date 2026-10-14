import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { scoreColor, scoreLabel } from "@/api/client";

interface Props {
  score: number;
  size?: number;
}

export default function ScoreGauge({ score, size = 220 }: Props) {
  const [displayed, setDisplayed] = useState(0);
  const raf = useRef<number>(0);

  // Animate the number counter
  useEffect(() => {
    const start = performance.now();
    const duration = 1400;
    const from = 0;
    const to = score;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (to - from) * ease));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [score]);

  // Semicircle arc geometry
  const R = 80;
  const cx = 110;
  const cy = 105;
  const totalArc = Math.PI * R; // πr for a half circle
  const fillArc = totalArc * (score / 100);
  const offset = totalArc - fillArc;

  const color = scoreColor(score);
  const label = scoreLabel(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size * 0.6}
        viewBox="0 0 220 132"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const angle = Math.PI - (i / 10) * Math.PI;
          const x1 = cx + (R + 4) * Math.cos(angle);
          const y1 = cy - (R + 4) * Math.sin(angle);
          const x2 = cx + (R + 11) * Math.cos(angle);
          const y2 = cy - (R + 11) * Math.sin(angle);
          const isMain = i % 5 === 0;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isMain ? "#2a3d56" : "#1e2d45"}
              strokeWidth={isMain ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Track arc */}
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          stroke="#1a2236"
          strokeWidth={14}
          strokeLinecap="round"
        />

        {/* Fill arc - animated */}
        <motion.path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${totalArc} ${totalArc}`}
          initial={{ strokeDashoffset: totalArc }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />

        {/* Glow dot at end of arc */}
        <motion.circle
          cx={cx + R * Math.cos(Math.PI * (1 - score / 100))}
          cy={cy - R * Math.sin(Math.PI * (1 - score / 100))}
          r={6}
          fill={color}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />

        {/* Score number */}
        <text
          x={cx}
          y={cy - 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize={40}
          fontWeight={600}
          fill={color}
        >
          {displayed}
        </text>

        {/* /100 */}
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="DM Sans, sans-serif"
          fontSize={12}
          fill="#4a5b78"
        >
          out of 100
        </text>

        {/* Min/Max labels */}
        <text x={cx - R} y={cy + 20} textAnchor="middle" fontSize={10} fill="#4a5b78" fontFamily="JetBrains Mono, monospace">0</text>
        <text x={cx + R} y={cy + 20} textAnchor="middle" fontSize={10} fill="#4a5b78" fontFamily="JetBrains Mono, monospace">100</text>
      </svg>

      {/* Label badge */}
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="text-sm font-semibold px-4 py-1 rounded-full"
        style={{
          background: `${color}18`,
          color,
          border: `1px solid ${color}40`,
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        {label}
      </motion.span>
    </div>
  );
}
