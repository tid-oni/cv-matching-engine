import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useI18n } from "../../context/I18nContext";
import { useEffect, useState } from "react";
import { LogOut, ChevronDown, Menu, X, Sun, Moon } from "lucide-react";
import { MetalButton } from "@/components/ui/metal-button";

const ROLE_PREFIXES = ["/dashboard", "/jobs", "/applications", "/recruiter", "/admin"];
const onRolePath = (p: string) => ROLE_PREFIXES.some(r => p === r || p.startsWith(r + "/"));

const publicNav = [
  { to: "/match", label: "Match CV" },
  { to: "/batch", label: "Batch Rank" },
  { to: "/about", label: "About" },
];

const candidateNav = [
  { to: "/dashboard",    label: "Dashboard" },
  { to: "/jobs",         label: "Find Jobs" },
  { to: "/applications", label: "Applications" },
];

const recruiterNav = [
  { to: "/dashboard",      label: "Dashboard" },
  { to: "/recruiter/jobs", label: "My Jobs" },
];

const adminNav = [
  { to: "/admin",             label: "Dashboard" },
  { to: "/admin/users",       label: "Users" },
  { to: "/admin/jobs",        label: "Jobs" },
  { to: "/admin/statistics",  label: "Statistics" },
  { to: "/admin/monitor",     label: "Monitor" },
];

const roleBadge: Record<string, string> = {
  candidate: "text-white/50 border-white/[0.15]",
  recruiter: "text-white/50 border-white/[0.15]",
  admin:     "text-white/70 border-white/[0.25]",
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled]       = useState(false);

  /* Light chrome only on role routes when light theme is active */
  const onRole      = onRolePath(location.pathname);
  const lightChrome = onRole && theme === "light";
  const showToggles = !!user && onRole;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const navItems =
    user?.role === "admin"     ? adminNav :
    user?.role === "recruiter" ? recruiterNav : candidateNav;

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: lightChrome
          ? (scrolled ? "rgba(255,255,255,0.90)" : "rgba(246,247,251,0.70)")
          : (scrolled ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.35)"),
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: scrolled
          ? `1px solid ${lightChrome ? "rgba(15,17,23,0.08)" : "rgba(255,255,255,0.06)"}`
          : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo — text only */}
          <Link
            to="/"
            className="text-white font-bold text-lg tracking-tight hover:text-white/70 transition-colors duration-200"
          >
            MatchAI
          </Link>

          {/* Desktop nav — text only, Lusion style */}
          <div className="hidden md:flex items-center gap-8">
            {(user ? navItems : publicNav).map(({ to, label }) => {
              const active = location.pathname === to || location.pathname.startsWith(to + "/");
              return (
                <Link
                  key={to}
                  to={to}
                  className={`text-sm font-medium transition-colors duration-200 ${
                    active ? "text-white" : "text-white/35 hover:text-white"
                  }`}
                >
                  {t(label)}
                </Link>
              );
            })}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Theme + language toggles — role pages only */}
            {showToggles && (
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTheme}
                  title={theme === "dark" ? t("Light") : t("Dark")}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button
                  onClick={toggleLang}
                  title={lang === "en" ? "Français" : "English"}
                  className="h-8 px-2 flex items-center justify-center rounded-lg text-xs font-bold text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  {lang === "en" ? "FR" : "EN"}
                </button>
              </div>
            )}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-white/[0.06] transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                    style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa, #f472b6)" }}
                  >
                    {user.full_name[0]?.toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm text-white/60 font-medium max-w-[100px] truncate">
                    {user.full_name.split(" ")[0]}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-white/25 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden z-50"
                      style={{ background: lightChrome ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.96)", backdropFilter: "blur(24px)" }}
                      onMouseLeave={() => setProfileOpen(false)}
                    >
                      <div className="px-4 py-3.5 border-b border-white/[0.06]">
                        <p className="text-sm font-semibold text-white truncate">{user.full_name}</p>
                        <p className="text-xs text-white/30 truncate mt-0.5">{user.email}</p>
                        <span className={`inline-flex mt-2 text-[11px] px-2 py-0.5 rounded-full border font-medium ${roleBadge[user.role] ?? "text-white/40 border-white/10"}`}>
                          {user.role}
                        </span>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                          <LogOut size={13} />
                          {t("Sign out")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="hidden sm:block text-sm text-white/35 hover:text-white transition-colors duration-200 font-medium px-3 py-2"
                >
                  Sign in
                </Link>
                <Link to="/register">
                  <MetalButton className="text-xs h-8 px-4">Get started</MetalButton>
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-1.5 text-white/35 hover:text-white transition-colors rounded-lg"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="md:hidden overflow-hidden border-t border-white/[0.06]"
            style={{ background: lightChrome ? "rgba(255,255,255,0.98)" : "rgba(0,0,0,0.98)" }}
          >
            <div className="px-4 py-4 space-y-0.5">
              {(user ? navItems : publicNav).map(({ to, label }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? "text-white bg-white/[0.06]"
                        : "text-white/40 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {t(label)}
                  </Link>
                );
              })}

              {!user && (
                <Link
                  to="/login"
                  className="block px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  Sign in
                </Link>
              )}

              {user && (
                <div className="border-t border-white/[0.06] pt-2 mt-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}