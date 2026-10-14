import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { CanvasRevealEffect } from "@/components/ui/canvas-reveal-effect";
import { Eye, EyeOff, Loader2 } from "lucide-react";

/* ── Animated nav link ──────────────────────────────────────────── */
function AnimatedNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group relative inline-flex items-center overflow-hidden h-5 text-sm"
    >
      <div className="flex flex-col transition-transform duration-300 ease-out group-hover:-translate-y-1/2">
        <span className="text-gray-400">{children}</span>
        <span className="text-white">{children}</span>
      </div>
    </a>
  );
}

/* ── Mini navbar (MatchAI branding) ─────────────────────────────── */
function MiniNavbar() {
  const [isOpen, setIsOpen]               = useState(false);
  const [shapeClass, setShapeClass]       = useState("rounded-full");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isOpen) {
      setShapeClass("rounded-xl");
    } else {
      timerRef.current = setTimeout(() => setShapeClass("rounded-full"), 300);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isOpen]);

  const navLinks = [
    { label: "Home",  href: "/" },
    { label: "About", href: "/about" },
  ];

  return (
    <header
      className={cn(
        "fixed top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center",
        "pl-6 pr-6 py-3 backdrop-blur-sm border border-[#333] bg-[#1f1f1f57]",
        "w-[calc(100%-2rem)] sm:w-auto",
        shapeClass
      )}
      style={{ transition: "border-radius 0s" }}
    >
      <div className="flex items-center justify-between w-full gap-x-6 sm:gap-x-8">
        {/* Logo */}
        <Link to="/" className="font-bold text-white text-sm tracking-tight shrink-0">
          MatchAI
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center space-x-6">
          {navLinks.map(({ label, href }) => (
            <AnimatedNavLink key={href} href={href}>{label}</AnimatedNavLink>
          ))}
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Link
            to="/login"
            className="px-4 py-2 text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full hover:border-white/50 hover:text-white transition-colors duration-200"
          >
            Sign in
          </Link>
          <div className="relative group">
            <div className="absolute inset-0 -m-2 rounded-full bg-gray-100 opacity-40 blur-lg pointer-events-none transition-all duration-300 group-hover:opacity-60 group-hover:blur-xl" />
            <Link
              to="/register"
              className="relative z-10 px-4 py-2 text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full hover:from-gray-200 hover:to-gray-400 transition-all duration-200 block"
            >
              Sign up
            </Link>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex items-center justify-center w-8 h-8 text-gray-300"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile panel */}
      <div
        className={cn(
          "sm:hidden flex flex-col items-center w-full transition-all ease-in-out duration-300 overflow-hidden",
          isOpen ? "max-h-96 opacity-100 pt-4" : "max-h-0 opacity-0 pt-0 pointer-events-none"
        )}
      >
        <nav className="flex flex-col items-center space-y-4 text-base w-full">
          {navLinks.map(({ label, href }) => (
            <a key={href} href={href} className="text-gray-300 hover:text-white transition-colors w-full text-center">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col items-center space-y-3 mt-4 w-full">
          <Link to="/login" className="w-full text-center px-4 py-2.5 text-sm border border-[#333] bg-[rgba(31,31,31,0.62)] text-gray-300 rounded-full">
            Sign in
          </Link>
          <Link to="/register" className="w-full text-center px-4 py-2.5 text-sm font-semibold text-black bg-gradient-to-br from-gray-100 to-gray-300 rounded-full">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ── SignInPage props ────────────────────────────────────────────── */
export interface SignInPageProps {
  className?: string;
  onLogin?:   (email: string, password: string) => Promise<void>;
}

/* ── Main sign-in page ──────────────────────────────────────────── */
export const SignInPage = ({ className, onLogin }: SignInPageProps) => {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step,         setStep]         = useState<"email" | "password" | "success">("email");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  /* Canvas animation state — mirrors the original OTP reverse-canvas pattern */
  const [initialCanvas, setInitialCanvas] = useState(true);
  const [reverseCanvas, setReverseCanvas] = useState(false);

  const handleEmailSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (email.trim()) setStep("password");
  };

  const handlePasswordSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");

    /* Start outro canvas (reverse reveal from edges → center) */
    setReverseCanvas(true);
    setTimeout(() => setInitialCanvas(false), 80);

    try {
      await onLogin?.(email, password);
      setTimeout(() => setStep("success"), 1800);
    } catch {
      setError("Invalid credentials. Check your email and password.");
      setReverseCanvas(false);
      setInitialCanvas(true);
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setError("");
    setReverseCanvas(false);
    setInitialCanvas(true);
  };

  return (
    <div className={cn("flex w-full flex-col min-h-screen bg-black relative", className)}>

      {/* ── Canvas background layer ──────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        {/* Intro canvas: dots reveal from center outward */}
        {initialCanvas && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={3}
              containerClassName="bg-black"
              colors={[[255, 255, 255], [255, 255, 255]]}
              dotSize={6}
              reverse={false}
              showGradient={false}
            />
          </div>
        )}
        {/* Outro canvas: dots disappear from edges inward */}
        {reverseCanvas && (
          <div className="absolute inset-0">
            <CanvasRevealEffect
              animationSpeed={4}
              containerClassName="bg-black"
              colors={[[255, 255, 255], [255, 255, 255]]}
              dotSize={6}
              reverse={true}
              showGradient={false}
            />
          </div>
        )}
        {/* Radial darkening so the form reads clearly */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,1)_0%,_transparent_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-black to-transparent" />
      </div>

      {/* ── Content layer ───────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col flex-1">
        <MiniNavbar />

        <div className="flex flex-1 flex-col lg:flex-row">
          {/* Form column — centred */}
          <div className="flex-1 flex flex-col justify-center items-center px-4">
            <div className="w-full mt-[150px] max-w-sm">
              <AnimatePresence mode="wait">

                {/* ── Step 1: Email ──────────────────────────── */}
                {step === "email" && (
                  <motion.div
                    key="email"
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center"
                  >
                    <div className="space-y-1">
                      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                        Welcome back
                      </h1>
                      <p className="text-[1.5rem] text-white/60 font-light">Sign in to MatchAI</p>
                    </div>

                    <div className="space-y-4">
                      {/* Email input */}
                      <form onSubmit={handleEmailSubmit}>
                        <div className="relative">
                          <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full backdrop-blur-[1px] text-white border border-white/10 bg-transparent rounded-full py-3 pl-4 pr-14 focus:outline-none focus:border-white/30 text-center"
                            required
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="absolute right-1.5 top-1.5 text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors group overflow-hidden"
                          >
                            <span className="relative w-full h-full block overflow-hidden">
                              <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-full">
                                →
                              </span>
                              <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 -translate-x-full group-hover:translate-x-0">
                                →
                              </span>
                            </span>
                          </button>
                        </div>
                      </form>
                    </div>

                    <p className="text-xs text-white/40 pt-8">
                      No account?{" "}
                      <Link
                        to="/register"
                        className="underline text-white/40 hover:text-white/70 transition-colors"
                      >
                        Create one free
                      </Link>
                    </p>
                  </motion.div>
                )}

                {/* ── Step 2: Password ───────────────────────── */}
                {step === "password" && (
                  <motion.div
                    key="password"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="space-y-6 text-center"
                  >
                    <div className="space-y-1">
                      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                        Enter password
                      </h1>
                      <p className="text-[1rem] text-white/50 font-light truncate px-2">
                        {email}
                      </p>
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      {/* Password input — styled like the OTP pill box */}
                      <div className="relative rounded-full py-4 px-5 border border-white/10 bg-transparent">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full text-center text-xl bg-transparent text-white border-none focus:outline-none focus:ring-0 placeholder-white/20 pr-8"
                          autoFocus
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      {/* Error */}
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-white/50"
                        >
                          {error}
                        </motion.p>
                      )}

                      {/* Actions */}
                      <div className="flex w-full gap-3">
                        <motion.button
                          type="button"
                          onClick={handleBack}
                          className="rounded-full bg-white text-black font-medium px-8 py-3 hover:bg-white/90 transition-colors w-[30%]"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Back
                        </motion.button>
                        <motion.button
                          type="submit"
                          disabled={!password || loading}
                          className={cn(
                            "flex-1 rounded-full font-medium py-3 border transition-all duration-300 flex items-center justify-center gap-2",
                            password && !loading
                              ? "bg-white text-black border-transparent hover:bg-white/90 cursor-pointer"
                              : "bg-[#111] text-white/50 border-white/10 cursor-not-allowed"
                          )}
                          whileHover={password && !loading ? { scale: 1.02 } : {}}
                          whileTap={password && !loading ? { scale: 0.98 } : {}}
                        >
                          {loading ? (
                            <><Loader2 size={14} className="animate-spin" /> Signing in…</>
                          ) : (
                            "Sign in"
                          )}
                        </motion.button>
                      </div>
                    </form>

                    <p className="text-xs text-white/40 pt-8">
                      By signing in you agree to our{" "}
                      <a href="#" className="underline hover:text-white/60 transition-colors">Terms</a>
                      {" "}and{" "}
                      <a href="#" className="underline hover:text-white/60 transition-colors">Privacy Policy</a>.
                    </p>
                  </motion.div>
                )}

                {/* ── Step 3: Success ────────────────────────── */}
                {step === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                    className="space-y-6 text-center"
                  >
                    <div className="space-y-1">
                      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                        You're in!
                      </h1>
                      <p className="text-[1.25rem] text-white/50 font-light">Welcome back</p>
                    </div>

                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      className="py-10"
                    >
                      <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-white to-white/70 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-8 w-8 text-black"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                    >
                      <div className="w-full rounded-full bg-white/10 text-white/50 font-medium py-3 text-center text-sm flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Redirecting to Dashboard…
                      </div>
                    </motion.div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};