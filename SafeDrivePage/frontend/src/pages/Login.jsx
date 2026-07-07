import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatApiError } from "@/lib/api";
import { ShieldCheck, ArrowLeft, Eye, EyeSlash, Lock, Envelope, SignIn, Key, CheckCircle } from "@phosphor-icons/react";

function TokenGate({ onVerified }) {
  const { verifySiteToken, clearSiteToken } = useAuth();
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [driverTokens, setDriverTokens] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const submitToken = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const info = await verifySiteToken(tokenInput.trim());
      setTokenInfo(info);
      setVerified(true);
      // Load associated driver tokens
      setLoadingDrivers(true);
      try {
        const { data } = await api.get(`/auth/monitor-token-drivers/${tokenInput.trim()}`);
        setDriverTokens(data.tokens || []);
      } catch {}
      setLoadingDrivers(false);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  const clearAndRetry = () => {
    clearSiteToken();
    setVerified(false);
    setTokenInfo(null);
    setDriverTokens([]);
    setTokenInput("");
  };

  if (verified) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="w-full max-w-md relative fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#FF2A2A]/10 rounded-xl flex items-center justify-center">
              <ShieldCheck size={24} weight="fill" className="text-[#FF2A2A]" />
            </div>
            <div>
              <span className="font-heading font-black text-xl tracking-tight text-white block">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-tel">Token Verificado</span>
            </div>
          </div>

          <div className="card-glass-strong p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <CheckCircle size={18} weight="fill" className="text-emerald-400" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg">{tokenInfo?.name || "Token verificado"}</h2>
                <p className="text-zinc-500 text-xs">Token de monitorista validado correctamente</p>
              </div>
            </div>

            {loadingDrivers ? (
              <div className="flex items-center justify-center py-4">
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : driverTokens.length > 0 ? (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400 mb-2">
                  Tokens de conductores disponibles ({driverTokens.length})
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {driverTokens.map((t) => (
                    <div key={t.token} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2 border border-zinc-700/50">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-200 truncate">{t.name || "Sin nombre"}</p>
                        <code className="text-[10px] text-zinc-500 font-mono">{t.token.slice(0, 16)}...</code>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.device_id ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                        {t.device_id ? 'Vinculado' : 'Disponible'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 text-center py-2">No hay tokens de conductores generados aún</p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button onClick={onVerified}
                className="flex-1 bg-white text-black font-bold py-2.5 rounded-xl hover:bg-zinc-200 transition-all text-sm">
                Continuar al inicio de sesión
              </button>
              <button onClick={clearAndRetry}
                className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs border border-zinc-700/50 transition-all">
                Usar otro token
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-[#FF2A2A]/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#007AFF]/3 via-transparent to-transparent pointer-events-none" />
      <Link to="/" className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors group">
        <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-all">
          <ArrowLeft size={14} />
        </div>
      </Link>
      <div className="w-full max-w-sm relative fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/5">
            <ShieldCheck size={24} weight="fill" className="text-black" />
          </div>
          <div>
            <span className="font-heading font-black text-xl tracking-tight text-white block">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-tel">Acceso Monitorista</span>
          </div>
        </div>

        <div className="card-glass-strong p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-[#FF2A2A]/10 rounded-xl flex items-center justify-center">
              <Key size={18} weight="bold" className="text-[#FF2A2A]" />
            </div>
            <div>
              <h1 className="font-heading font-black text-lg tracking-tight">Token de Acceso</h1>
              <p className="text-zinc-500 text-xs">Ingresa el token proporcionado por tu proveedor.</p>
            </div>
          </div>

          <form onSubmit={submitToken} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">Token &uacute;nico</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                required
                className="w-full bg-[#0d0d0d] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2.5 text-white text-sm outline-none transition-all font-mono text-center tracking-widest"
              />
            </div>
            {error && (
              <div className="text-sm border border-[#FF2A2A]/30 bg-[#FF2A2A]/10 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <span className="text-[#FF2A2A] text-xs">{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !tokenInput.trim()}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Verificando…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle size={18} weight="bold" />
                  Validar acceso
                </span>
              )}
            </button>
          </form>
        </div>

        <p className="text-zinc-700 text-xs mt-6 font-tel text-center">
          Este token se solicita una &uacute;nica vez por dispositivo.
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const u = await login(email, password);
      navigate(u?.role === "superadmin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-[#FF2A2A]/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#007AFF]/3 via-transparent to-transparent pointer-events-none" />
      <Link to="/" data-testid="back-home-link" className="absolute top-6 left-6 text-zinc-500 hover:text-white flex items-center gap-2 text-sm transition-colors group">
        <div className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center group-hover:border-white/30 transition-all">
          <ArrowLeft size={14} />
        </div>
      </Link>
      <div className="w-full max-w-sm relative fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/5">
            <ShieldCheck size={24} weight="fill" className="text-black" />
          </div>
          <div>
            <span className="font-heading font-black text-xl tracking-tight text-white block">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-tel">Centro de Control</span>
          </div>
        </div>

        <div className="card-glass-strong p-6 rounded-2xl">
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
                  placeholder="correo@ejemplo.com"
                  className="w-full bg-[#0d0d0d] border border-white/10 focus:border-white/30 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none transition-all font-tel"
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
                  className="w-full bg-[#0d0d0d] border border-white/10 focus:border-white/30 rounded-xl pl-9 pr-9 py-2.5 text-white text-sm outline-none transition-all font-tel"
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
              <div data-testid="login-error" className="text-sm border border-[#FF2A2A]/30 bg-[#FF2A2A]/10 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <span className="text-[#FF2A2A]">{error}</span>
              </div>
            )}
            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={busy}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
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

export default function Login() {
  const { siteToken } = useAuth();
  const [tokenReady, setTokenReady] = useState(!!siteToken);

  if (!tokenReady) {
    return <TokenGate onVerified={() => setTokenReady(true)} />;
  }

  return <LoginForm />;
}
