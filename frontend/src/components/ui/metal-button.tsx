import * as React from "react";
import { cn } from "@/lib/utils";

type ColorVariant = "default" | "gold" | "silver";

interface MetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ColorVariant;
}

const colorVariants: Record<ColorVariant, {
  outer: string; inner: string; button: string; textColor: string; textShadow: string;
}> = {
  default: {
    outer:      "bg-gradient-to-b from-[#000] to-[#A0A0A0]",
    inner:      "bg-gradient-to-b from-[#FAFAFA] via-[#3E3E3E] to-[#E5E5E5]",
    button:     "bg-gradient-to-b from-[#B9B9B9] to-[#969696]",
    textColor:  "text-white",
    textShadow: "[text-shadow:_0_-1px_0_rgb(80_80_80_/_100%)]",
  },
  gold: {
    outer:      "bg-gradient-to-b from-[#917100] to-[#EAD98F]",
    inner:      "bg-gradient-to-b from-[#FFFDDD] via-[#856807] to-[#FFF1B3]",
    button:     "bg-gradient-to-b from-[#FFEBA1] to-[#9B873F]",
    textColor:  "text-[#1a1000]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(178_140_2_/_40%)]",
  },
  silver: {
    outer:      "bg-gradient-to-b from-[#555] to-[#ccc]",
    inner:      "bg-gradient-to-b from-[#f0f0f0] via-[#888] to-[#ddd]",
    button:     "bg-gradient-to-b from-[#d0d0d0] to-[#999]",
    textColor:  "text-[#111]",
    textShadow: "[text-shadow:_0_-1px_0_rgb(100_100_100_/_40%)]",
  },
};

const ShineEffect = ({ isPressed }: { isPressed: boolean }) => (
  <div className={cn(
    "pointer-events-none absolute inset-0 z-20 overflow-hidden transition-opacity duration-300 rounded-full",
    isPressed ? "opacity-20" : "opacity-0"
  )}>
    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
  </div>
);

export const MetalButton = React.forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ children, className, variant = "default", ...props }, ref) => {
    const [isPressed, setIsPressed] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isTouchDevice, setIsTouchDevice] = React.useState(false);
    const v = colorVariants[variant];

    React.useEffect(() => {
      setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
    }, []);

    const transitionStyle = "all 220ms cubic-bezier(0.1, 0.4, 0.2, 1)";

    return (
      <div
        className={cn("relative inline-flex transform-gpu rounded-full p-[1.5px] will-change-transform", v.outer)}
        style={{
          transform: isPressed ? "translateY(2px) scale(0.99)" : "translateY(0) scale(1)",
          boxShadow: isPressed
            ? "0 1px 2px rgba(0,0,0,0.2)"
            : isHovered && !isTouchDevice
              ? "0 6px 20px rgba(0,0,0,0.25)"
              : "0 3px 10px rgba(0,0,0,0.15)",
          transition: transitionStyle,
        }}
      >
        <div
          className={cn("absolute inset-[1.5px] transform-gpu rounded-full will-change-transform", v.inner)}
          style={{
            transition: transitionStyle,
            filter: isHovered && !isPressed && !isTouchDevice ? "brightness(1.06)" : "none",
          }}
        />
        <button
          ref={ref}
          className={cn(
            "relative z-10 m-[1.5px] rounded-full inline-flex h-10 transform-gpu cursor-pointer",
            "items-center justify-center overflow-hidden px-6 text-sm font-semibold",
            "will-change-transform outline-none",
            v.button, v.textColor, v.textShadow, className
          )}
          style={{
            transform: isPressed ? "scale(0.97)" : "scale(1)",
            transition: transitionStyle,
            filter: isHovered && !isPressed && !isTouchDevice ? "brightness(1.03)" : "none",
          }}
          {...props}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => { setIsPressed(false); setIsHovered(false); }}
          onMouseEnter={() => { if (!isTouchDevice) setIsHovered(true); }}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          onTouchCancel={() => setIsPressed(false)}
        >
          <ShineEffect isPressed={isPressed} />
          {children}
          {isHovered && !isPressed && !isTouchDevice && (
            <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/8" />
          )}
        </button>
      </div>
    );
  }
);

MetalButton.displayName = "MetalButton";