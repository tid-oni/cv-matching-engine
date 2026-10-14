import type { ReactNode } from "react";

type Variant = "default" | "success" | "warning" | "danger" | "info" | "violet";

const variants: Record<Variant, string> = {
  default: "bg-white/[0.06] text-white/50 border-white/10",
  success: "bg-white/[0.08] text-white/70 border-white/12",
  warning: "bg-white/[0.05] text-white/45 border-white/8",
  danger:  "bg-white/[0.04] text-white/35 border-white/6",
  info:    "bg-white/[0.07] text-white/60 border-white/10",
  violet:  "bg-white/[0.06] text-white/55 border-white/9",
};

export function statusVariant(status: string): Variant {
  switch (status) {
    case "hired":       return "success";
    case "shortlisted": return "info";
    case "reviewed":    return "violet";
    case "rejected":    return "danger";
    default:            return "warning";
  }
}

export default function Badge({ children, variant = "default" }: { children: ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[variant]}`}>
      {children}
    </span>
  );
}