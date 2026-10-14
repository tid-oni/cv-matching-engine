import { Suspense, lazy, Component } from "react";
import type { ReactNode } from "react";

const Spline = lazy(() => import("@splinetool/react-spline"));

interface SplineSceneProps {
  scene: string;
  className?: string;
}

class SplineErrorBoundary extends Component<
  { children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) {
      return (
        <div className="w-full h-full relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 65% at 55% 50%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 35%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 animate-spin-slow"
            style={{
              background:
                "conic-gradient(from 0deg at 55% 50%, transparent 0deg, rgba(255,255,255,0.04) 90deg, transparent 180deg, rgba(255,255,255,0.04) 270deg, transparent 360deg)",
              animationDuration: "40s",
            }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <SplineErrorBoundary>
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <span className="loader" />
          </div>
        }
      >
        <Spline scene={scene} className={className} />
      </Suspense>
    </SplineErrorBoundary>
  );
}