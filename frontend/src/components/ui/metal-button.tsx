import * as React from "react";
import { cn } from "@/lib/utils";

type MetalButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Primary CTA button — iridescent gradient pill (cyan → violet → fuchsia)
 * with a glossy top highlight and a sweeping shine on hover.
 * Sizing/spacing is driven by `className` (e.g. `h-8 px-4 text-xs`).
 */
export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "group/metal relative inline-flex h-10 items-center justify-center gap-2 rounded-full px-6",
          "text-sm font-bold text-black overflow-hidden outline-none cursor-pointer",
          "transition-transform duration-200 hover:scale-[1.03] active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          className
        )}
        style={{
          background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #f472b6 100%)",
          boxShadow: "0 10px 30px rgba(167,139,250,0.38), inset 0 1px 0 rgba(255,255,255,0.55)",
          ...props.style,
        }}
      >
        {/* glossy top highlight */}
        <span
          className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.45), transparent)" }}
        />
        {/* sweeping shine on hover */}
        <span
          className="absolute inset-0 -translate-x-full group-hover/metal:translate-x-full transition-transform duration-700 ease-out pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)" }}
        />
        <span className="relative flex items-center gap-2">{children}</span>
      </button>
    );
  }
);

MetalButton.displayName = "MetalButton";
