import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  ShieldCheck, DeviceMobile, Cpu, Monitor, Lock, Bridge, Siren, NavigationArrow, WifiSlash,
  ChatCircleDots, Broadcast, ShoppingCart, X, WhatsappLogo, EnvelopeSimple, Check, ArrowRight, Database,
  Truck, MapPinLine, ClockCounterClockwise, Eye, CellSignalHigh,
} from "@phosphor-icons/react";

const WHATSAPP = "528674718298";
const EMAIL = "leijahector5@gmail.com";
const CYCLES = ["Semanal", "Mensual", "Bimestral", "Trimestral", "Anual"];
const HERO = "https://images.pexels.com/photos/11053643/pexels-photo-11053643.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const mx = (n) => `$${n.toLocaleString("es-MX")} MXN`;

const FEATURES = [
  { icon: Lock, t: "Launcher Seguro", d: "Sobre 5 km/h la app toma la pantalla. Si el chofer intenta abrir redes sociales, se genera reporte de desacato automatico." },
  { icon: NavigationArrow, t: "HUD Nocturno", d: "Pantalla de alto contraste con modo reflejo para parabrisas en la peligrosa Monterrey - Nuevo Laredo." },
  { icon: ChatCircleDots, t: "Chat con bloqueo de teclado", d: "En movimiento solo respuestas rapidas con un toque. El texto libre se desbloquea a 0 km/h." },
  { icon: Database, t: "Caja Negra Terrestre", d: "En zonas muertas almacena todo en SQLite local y envia en rafaga al recuperar red." },
  { icon: Siren, t: "Pánico Silencioso", d: "Patron con botones de volumen: activa protocolo silencioso, comparte ubicacion y manda alerta roja." },
  { icon: WifiSlash, t: "Deteccion de Jammer", d: "Si pierde senal fuera de una zona muerta conocida, se asume inhibidor y activa protocolo de emergencia." },
];

export default function Landing() {
  const [plans, setPlans] = useState([]);
  const [onboarding, setOnboarding] = useState([]);
  const [cycle, setCycle] = useState("Mensual");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    api.get("/plans").then((r) => { setPlans(r.data.plans); setOnboarding(r.data.onboarding); }).catch(() => {});
  }, []);

  const addToCart = (item) => {
    setCart((c) => [...c.filter((x) => x.key !== item.key), item]);
    setCartOpen(true);
    toast.success(`${item.name} agregado al carrito`);
  };
  const removeFromCart = (key) => setCart((c) => c.filter((x) => x.key !== key));
  const total = cart.reduce((s, i) => s + i.price, 0);

  const buildMessage = () => {
    let msg = "Hola, quiero contratar SafeDrive GPS:%0A%0A";
    cart.forEach((i) => { msg += `• ${i.name}: ${mx(i.price).replace(/ /g, "%20")}%0A`; });
    msg += `%0ATOTAL: ${mx(total).replace(/ /g, "%20")}`;
    return msg;
  };
  const orderWhatsApp = () => {
    if (!cart.length) return toast.error("El carrito esta vacio");
    window.open(`https://wa.me/${WHATSAPP}?text=${buildMessage()}`, "_blank");
  };
  const orderEmail = () => {
    if (!cart.length) return toast.error("El carrito esta vacio");
    const body = buildMessage().replace(/%0A/g, "\n").replace(/%20/g, " ");
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent("Pedido SafeDrive GPS")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="bg-[#050505] text-white min-h-screen">
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <ShieldCheck size={22} weight="fill" className="text-black" />
            </div>
            <span className="font-heading font-black text-lg tracking-tight">
              SafeDrive<span className="text-[#FF2A2A]">GPS</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="#planes" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors font-medium">Planes</a>
            <button
              data-testid="open-cart-button"
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-zinc-300 hover:text-white transition-colors"
            >
              <ShoppingCart size={20} />
              {cart.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#FF2A2A] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-tel font-bold">
                  {cart.length}
                </span>
              )}
            </button>
            <Link
              to="/login"
              data-testid="nav-login-link"
              className="text-sm bg-white text-black font-bold px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Acceso monitoristas
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="Camion de carga de noche" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/75" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 40%,#050505)" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-28 lg:py-40">
          <div className="inline-flex items-center gap-2 border border-white/15 rounded-full px-3.5 py-1.5 text-xs font-tel text-zinc-300 mb-6 fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] pulse-safe" />
            Ecosistema Fronterizo · Nuevo Laredo
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight max-w-3xl leading-[1.05] fade-up" style={{ animationDelay: "0.1s" }}>
            Seguridad activa que <span className="text-[#FF2A2A]">previene</span> el robo y los accidentes en tiempo real.
          </h1>
          <p className="text-zinc-300 text-base md:text-lg mt-6 max-w-xl fade-up" style={{ animationDelay: "0.2s" }}>
            No es un simple rastreador. SafeDrive GPS protege la vida del chofer, el patrimonio de la empresa y asegura los tiempos de cruce internacional.
          </p>
          <div className="flex flex-wrap gap-3 mt-8 fade-up" style={{ animationDelay: "0.3s" }}>
            <a href="#planes" data-testid="hero-plans-cta" className="bg-white text-black font-bold px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg shadow-white/10">
              Ver planes <ArrowRight size={18} weight="bold" />
            </a>
            <Link to="/login" data-testid="hero-login-cta" className="border border-white/20 hover:border-white/50 font-bold px-6 py-3 rounded-lg transition-colors">
              Centro de control
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-3 font-tel">Los 3 componentes</div>
        <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-10">Un ecosistema sincronizado</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: DeviceMobile, t: "App Móvil", s: "El Escudo del Operador", d: "Politica de cero distracciones, caja negra offline y boton de panico silencioso." },
            { icon: Cpu, t: "Backend Analítico", s: "El Cerebro", d: "Geoespacial con corredores de tolerancia, filtro de acelerometro e inteligencia de cobertura." },
            { icon: Monitor, t: "Dashboard Web", s: "Centro de Control Bento", d: "WebSockets en vivo, gestion por excepcion y difusion automatizada a autoridades." },
          ].map((c, i) => (
            <div key={c.t} className="card-tactical p-8 hover:border-white/20 transition-all duration-300 fade-up" style={{ animationDelay: `${0.1 * i}s` }}>
              <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-5">
                <c.icon size={26} weight="duotone" className="text-white" />
              </div>
              <div className="font-heading font-bold text-lg">{c.t}</div>
              <div className="text-[#FF2A2A] text-xs font-tel uppercase tracking-wider mb-3 mt-1">{c.s}</div>
              <p className="text-zinc-400 text-sm leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-3 font-tel">Caracteristicas</div>
        <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-10">Protección en cada kilómetro</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.t} className="card-tactical p-6 hover:border-white/20 transition-all duration-300 fade-up" style={{ animationDelay: `${0.05 * i}s` }}>
              <div className="w-10 h-10 rounded-lg bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-4">
                <f.icon size={22} weight="duotone" className="text-[#00E676]" />
              </div>
              <div className="font-bold mb-1.5 text-[15px]">{f.t}</div>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-24">
        <div className="card-tactical p-8 lg:p-12 relative overflow-hidden hover:border-white/20 transition-all duration-300">
          <Bridge size={160} weight="duotone" className="absolute -right-8 -bottom-8 text-[#007AFF]/8" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-[#007AFF] text-xs font-tel uppercase tracking-[0.2em] mb-4">
              <Bridge size={16} weight="fill" /> Factor Nuevo Laredo
            </div>
            <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight max-w-2xl">Módulo de Cruce Transfronterizo</h2>
            <p className="text-zinc-400 mt-4 max-w-2xl leading-relaxed">
              Al entrar a la zona del Puente del Comercio Mundial o Puente 3, se activa una geocerca de <b className="text-white">Espera Fiscal</b>: pausa las alertas por estar detenido y cronometra con precision matematica las horas exactas en la fila. Metrica oro para agencias aduanales e importadores en EE.UU.
            </p>
            <div className="flex flex-wrap gap-6 mt-6">
              {[
                { icon: MapPinLine, label: "Geocercas", value: "Puente 1, 2 y 3" },
                { icon: ClockCounterClockwise, label: "Monitoreo", value: "Tiempo exacto en fila" },
                { icon: CellSignalHigh, label: "Alertas", value: "Pausa automatica" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 text-sm">
                  <s.icon size={18} className="text-[#007AFF]" />
                  <div>
                    <div className="text-zinc-500 text-xs">{s.label}</div>
                    <div className="text-white font-semibold">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="planes" className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-3 font-tel">Suscripciones</div>
        <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-2">Paquetes de capacidad</h2>
        <p className="text-zinc-400 mb-8 text-sm">Precios fijos por paquete. Si tienes menos choferes, el precio se mantiene.</p>

        <div className="inline-flex flex-wrap gap-1 border border-white/10 rounded-lg p-1 mb-8">
          {CYCLES.map((c) => (
            <button
              key={c}
              data-testid={`cycle-${c}`}
              onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${cycle === c ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-white"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((p) => (
            <div
              key={p.id}
              data-testid={`plan-${p.id}`}
              className={`card-tactical p-6 flex flex-col transition-all duration-300 ${p.highlight ? "border-white/30 ring-1 ring-white/20 scale-[1.02]" : "hover:border-white/20"}`}
            >
              {p.highlight && (
                <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#00E676] mb-3 bg-[#00E676]/10 px-2.5 py-1 rounded-full self-start">
                  <Check size={10} weight="bold" /> Más popular
                </div>
              )}
              <div className="font-heading font-black text-2xl">{p.name}</div>
              <div className="text-zinc-500 text-sm mt-1">{p.tagline}</div>
              <div className="mt-6 flex items-end gap-2">
                <span className="font-tel font-bold text-4xl">{mx(p.prices[cycle])}</span>
                <span className="text-zinc-500 text-sm mb-1 font-tel">/ {cycle.toLowerCase()}</span>
              </div>
              <div className="text-xs text-zinc-500 font-tel mt-1.5">Hasta {p.devices} teléfonos · {p.per_truck}</div>
              <ul className="mt-6 space-y-3 text-sm flex-1">
                {["Monitoreo en tiempo real", "Geocercas de Nuevo Laredo", "Pánico silencioso + caja negra", "Cruce fiscal cronometrado"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-zinc-300">
                    <Check size={15} weight="bold" className="text-[#00E676] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                data-testid={`add-plan-${p.id}`}
                onClick={() => addToCart({ key: `plan-${p.id}`, name: `${p.name} (${cycle})`, price: p.prices[cycle] })}
                className={`mt-6 font-bold py-3 rounded-lg transition-all ${p.highlight ? "bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/10" : "border border-white/15 hover:border-white/50 hover:bg-white/5"}`}
              >
                Agregar al carrito
              </button>
            </div>
          ))}
        </div>

        <h3 className="font-heading font-bold text-lg mt-16 mb-5">Costo único inicial (Onboarding)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {onboarding.map((o) => (
            <div key={o.id} data-testid={`onboarding-${o.id}`} className="card-tactical p-5 flex items-center justify-between gap-4 hover:border-white/20 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Truck size={18} className="text-zinc-300" />
                </div>
                <div>
                  <div className="font-bold">{o.name}</div>
                  <p className="text-zinc-500 text-sm mt-0.5">{o.desc}</p>
                  <div className="font-tel font-bold text-xl mt-2">{mx(o.price)}</div>
                </div>
              </div>
              <button
                data-testid={`add-onboarding-${o.id}`}
                onClick={() => addToCart({ key: `onb-${o.id}`, name: o.name, price: o.price })}
                className="shrink-0 border border-white/15 hover:border-white/50 font-bold px-4 py-2 rounded-lg text-sm transition-all hover:bg-white/5"
              >
                Agregar
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 text-center">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
              <ShieldCheck size={14} weight="fill" className="text-black" />
            </div>
            <span className="font-heading font-black tracking-tight">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
          </div>
          <p className="text-zinc-600 text-sm font-tel">
            Seguridad activa y telemetria en tiempo real · Nuevo Laredo, Tamps.
          </p>
        </div>
      </footer>

      {cartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm fade-in" onClick={() => setCartOpen(false)} />
          <div data-testid="cart-drawer" className="relative w-full max-w-md bg-[#0a0a0a] border-l border-white/10 h-full flex flex-col slide-in-right">
            <div className="px-5 h-16 flex items-center justify-between border-b border-white/10">
              <span className="font-heading font-bold flex items-center gap-2 text-base">
                <ShoppingCart size={18} weight="fill" /> Carrito
              </span>
              <button data-testid="close-cart-button" onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center mt-16 gap-3">
                  <ShoppingCart size={32} className="text-zinc-700" />
                  <p className="text-zinc-600 text-sm">Tu carrito esta vacio.</p>
                  <p className="text-zinc-700 text-xs">Agrega un plan para comenzar.</p>
                </div>
              )}
              {cart.map((i) => (
                <div key={i.key} className="card-tactical p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{i.name}</div>
                    <div className="font-tel text-zinc-400 text-sm mt-0.5">{mx(i.price)}</div>
                  </div>
                  <button
                    data-testid={`remove-${i.key}`}
                    onClick={() => removeFromCart(i.key)}
                    className="w-7 h-7 rounded-md border border-white/10 flex items-center justify-center text-zinc-500 hover:text-[#FF2A2A] hover:border-[#FF2A2A]/30 transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10 space-y-3 bg-black/30">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm uppercase tracking-wider font-tel">Total</span>
                <span data-testid="cart-total" className="font-tel font-bold text-2xl">{mx(total)}</span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Recibe la información del plan por WhatsApp o correo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button data-testid="checkout-whatsapp" onClick={orderWhatsApp} className="bg-[#25D366] text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                  <WhatsappLogo size={20} weight="fill" /> WhatsApp
                </button>
                <button data-testid="checkout-email" onClick={orderEmail} className="border border-white/15 hover:border-white/50 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all hover:bg-white/5">
                  <EnvelopeSimple size={20} /> Correo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
