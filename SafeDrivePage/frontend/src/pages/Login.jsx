import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { ShieldCheck, ArrowLeft, Eye, EyeSlash, Lock, Envelope, SignIn } from "@phosphor-icons/react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("leijahector5@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-[#FF2A2A]/5 to-transparent pointer-events-none" />
      <Link to="/" data-testid="back-home-link" className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors group">
        <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-all">
          <ArrowLeft size={14} />
        </div>
      </Link>
      <div className="w-full max-w-sm relative fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-white/5">
            <ShieldCheck size={24} weight="fill" className="text-black" />
          </div>
          <div>
            <span className="font-heading font-black text-xl tracking-tight text-white block">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-tel">Centro de Control</span>
          </div>
        </div>

        <div className="card-tactical p-6">
          <h1 className="font-heading font-black text-2xl tracking-tight mb-1">Bienvenido</h1>
          <p className="text-zinc-500 text-sm mb-6">Acceso exclusivo para monitoristas autorizados.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">Correo electrónico</label>
              <div className="relative">
                <Envelope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#0d0d0d] border border-white/10 focus:border-white/40 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm outline-none transition-colors font-tel"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#0d0d0d] border border-white/10 focus:border-white/40 rounded-lg pl-9 pr-9 py-2.5 text-white text-sm outline-none transition-colors font-tel"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div data-testid="login-error" className="text-sm border border-[#FF2A2A]/30 bg-[#FF2A2A]/10 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <span className="text-[#FF2A2A]">{error}</span>
              </div>
            )}
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={busy}
              className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Verificando…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <SignIn size={18} weight="bold" />
                  Ingresar al panel
                </span>
              )}
            </button>
          </form>
        </div>

        <p className="text-zinc-700 text-xs mt-6 font-tel text-center flex items-center justify-center gap-1.5">
          <Lock size={12} /> Protegido por candado criptográfico de hardware.
        </p>
      </div>
    </div>
  );
}
