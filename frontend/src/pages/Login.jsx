import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { ShieldCheck, ArrowLeft } from "@phosphor-icons/react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("leijahector5@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <Link to="/" data-testid="back-home-link" className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors">
        <ArrowLeft size={16} /> Volver
      </Link>
      <div className="w-full max-w-sm relative fade-up">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 bg-white rounded-md flex items-center justify-center">
            <ShieldCheck size={22} weight="fill" className="text-black" />
          </div>
          <span className="font-heading font-black text-xl tracking-tight text-white">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
        </div>
        <h1 className="font-heading font-black text-3xl text-white tracking-tight">Centro de Control</h1>
        <p className="text-zinc-500 text-sm mt-2 mb-8">Acceso exclusivo para monitoristas autorizados.</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Correo</label>
            <input data-testid="login-email-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="mt-2 w-full bg-[#121212] border border-white/10 focus:border-white/40 rounded-md px-3 py-2.5 text-white text-sm outline-none transition-colors font-tel" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Contrasena</label>
            <input data-testid="login-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="mt-2 w-full bg-[#121212] border border-white/10 focus:border-white/40 rounded-md px-3 py-2.5 text-white text-sm outline-none transition-colors font-tel" />
          </div>
          {error && <div data-testid="login-error" className="text-[#FF2A2A] text-sm border border-[#FF2A2A]/30 bg-[#FF2A2A]/10 rounded-md px-3 py-2">{error}</div>}
          <button data-testid="login-submit-button" type="submit" disabled={busy}
            className="w-full bg-white text-black font-bold py-2.5 rounded-md hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {busy ? "Verificando…" : "Ingresar al panel"}
          </button>
        </form>
        <p className="text-zinc-600 text-xs mt-6 font-tel">Protegido por candado criptografico de hardware.</p>
      </div>
    </div>
  );
}
