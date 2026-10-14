import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { I18nProvider } from "./context/I18nContext";
import type { UserRole } from "./types";
import Navbar from "./components/layout/Navbar";

const AUTH_ROUTES = ["/login", "/register"];

/* Role-area route prefixes — the ONLY places the light theme applies. */
const ROLE_ROUTE_PREFIXES = ["/dashboard", "/jobs", "/applications", "/recruiter", "/admin"];
export const isRoleRoute = (path: string) =>
  ROLE_ROUTE_PREFIXES.some(p => path === p || path.startsWith(p + "/"));

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Match from "./pages/Match";
import Batch from "./pages/Batch";
import About from "./pages/About";

import CandidateDashboard from "./pages/candidate/Dashboard";
import Jobs from "./pages/candidate/Jobs";
import Applications from "./pages/candidate/Applications";

import RecruiterDashboard from "./pages/recruiter/Dashboard";
import RecruiterJobs from "./pages/recruiter/Jobs";
import JobForm from "./pages/recruiter/JobForm";
import Candidates from "./pages/recruiter/Candidates";
import CandidateDetail from "./pages/recruiter/CandidateDetail";
import JobStats from "./pages/recruiter/JobStats";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminMonitor from "./pages/admin/Monitor";
import AdminStatistics from "./pages/admin/Statistics";

function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: UserRole | UserRole[];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) {
      if (user.role === "admin") return <Navigate to="/admin" replace />;
      if (user.role === "recruiter") return <Navigate to="/dashboard" replace />;
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}

function SmartDashboard() {
  const { user } = useAuth();
  if (user?.role === "recruiter") return <RecruiterDashboard />;
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  return <CandidateDashboard />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { pathname }      = useLocation();
  const { theme }         = useTheme();
  const isAuthPage        = AUTH_ROUTES.includes(pathname);

  /* Apply the light theme ONLY on role-area routes. Every other route
     (landing, login, register, match, batch, about) stays pure dark. */
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light" && isRoleRoute(pathname)) {
      root.classList.add("theme-light");
    } else {
      root.classList.remove("theme-light");
    }
    return () => root.classList.remove("theme-light");
  }, [theme, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  return (
    <>
      {!isAuthPage && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route
          path="/match"
          element={<ProtectedRoute><Match /></ProtectedRoute>}
        />
        <Route
          path="/batch"
          element={<ProtectedRoute><Batch /></ProtectedRoute>}
        />
        <Route
          path="/about"
          element={<ProtectedRoute><About /></ProtectedRoute>}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" replace /> : <Register />}
        />

        {/* Smart dashboard — role-aware */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <SmartDashboard />
            </ProtectedRoute>
          }
        />

        {/* Candidate */}
        <Route
          path="/jobs"
          element={
            <ProtectedRoute role={["candidate", "admin"]}>
              <Jobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs/:jobId"
          element={
            <ProtectedRoute role={["candidate", "admin"]}>
              <Jobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute role="candidate">
              <Applications />
            </ProtectedRoute>
          }
        />

        {/* Recruiter */}
        <Route
          path="/recruiter/jobs"
          element={
            <ProtectedRoute role={["recruiter", "admin"]}>
              <RecruiterJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/new"
          element={
            <ProtectedRoute role="recruiter">
              <JobForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/edit"
          element={
            <ProtectedRoute role="recruiter">
              <JobForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/candidates"
          element={
            <ProtectedRoute role={["recruiter", "admin"]}>
              <Candidates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/candidates/:appId"
          element={
            <ProtectedRoute role={["recruiter", "admin"]}>
              <CandidateDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recruiter/jobs/:jobId/stats"
          element={
            <ProtectedRoute role={["recruiter", "admin"]}>
              <JobStats />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute role="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs"
          element={
            <ProtectedRoute role="admin">
              <RecruiterJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/monitor"
          element={
            <ProtectedRoute role="admin">
              <AdminMonitor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/statistics"
          element={
            <ProtectedRoute role="admin">
              <AdminStatistics />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
