import { cn } from "@/lib/utils";
import React from "react";
import { type LucideProps } from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";

type FeatureType = {
  title: string;
  icon: React.ComponentType<LucideProps>;
  description: string;
};

type FeatureCardProps = React.ComponentProps<"div"> & { feature: FeatureType };

function genRandomPattern(length = 5): number[][] {
  return Array.from({ length }, () => [
    Math.floor(Math.random() * 4) + 7,
    Math.floor(Math.random() * 6) + 1,
  ]);
}

function GridPattern({
  width, height, x, y, squares, ...props
}: React.ComponentProps<"svg"> & {
  width: number; height: number; x: string; y: string; squares?: number[][];
}) {
  const patternId = React.useId();
  return (
    <svg aria-hidden="true" {...props}>
      <defs>
        <pattern id={patternId} width={width} height={height} patternUnits="userSpaceOnUse" x={x} y={y}>
          <path d={`M.5 ${height}V.5H${width}`} fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${patternId})`} />
      {squares && (
        <svg x={x} y={y} className="overflow-visible">
          {squares.map(([sx, sy], i) => (
            <rect strokeWidth="0" key={i} width={width + 1} height={height + 1} x={sx * width} y={sy * height} />
          ))}
        </svg>
      )}
    </svg>
  );
}

export function FeatureCard({ feature, className, ...props }: FeatureCardProps) {
  const squares = React.useMemo(() => genRandomPattern(), []);
  return (
    <div className={cn("relative overflow-hidden p-7 group cursor-default", className)} {...props}>
      <Spotlight size={220} springOptions={{ bounce: 0 }} />
      {/* Grid pattern overlay */}
      <div className="pointer-events-none absolute top-0 left-1/2 -mt-2 -ml-20 h-full w-full [mask-image:linear-gradient(white,transparent)]">
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.03] to-white/[0.01] [mask-image:radial-gradient(farthest-side_at_top,white,transparent)] opacity-100">
          <GridPattern
            width={20}
            height={20}
            x="-12"
            y="4"
            squares={squares}
            className="fill-white/[0.04] stroke-white/[0.12] absolute inset-0 h-full w-full mix-blend-overlay"
          />
        </div>
      </div>
      <feature.icon
        className="text-white/50 size-5 group-hover:text-white/80 transition-colors duration-300"
        strokeWidth={1}
        aria-hidden
      />
      <h3 className="mt-8 text-sm font-semibold text-white tracking-wide">{feature.title}</h3>
      <p className="relative z-20 mt-2 text-xs text-white/40 font-light leading-relaxed">{feature.description}</p>
    </div>
  );
}

export { GridPattern };