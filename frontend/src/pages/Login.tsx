import { useNavigate } from "react-router-dom";
import { login } from "../api/platform";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { SignInPage } from "@/components/ui/sign-in-flow-1";

export default function Login() {
  const { setAuth }                    = useAuth();
  const { success } = useToast();
  const navigate                       = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    const data = await login(email, password);
    setAuth(data.access_token, data.user);
    success("Welcome back!", `Signed in as ${data.user.full_name}`);
    /* Navigate after the success animation plays (1800ms delay in SignInPage) */
    setTimeout(() => navigate("/dashboard"), 2200);
  };

  return <SignInPage onLogin={handleLogin} />;
}