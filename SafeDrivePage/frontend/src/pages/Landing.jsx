import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  ShieldCheck, DeviceMobile, Cpu, Monitor, Lock, Bridge, Siren, NavigationArrow, WifiSlash,
  ChatCircleDots, Broadcast, ShoppingCart, X, WhatsappLogo, EnvelopeSimple, Check, ArrowRight, Database,
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
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center"><ShieldCheck size={20} weight="fill" className="text-black" /></div>
            <span className="font-heading font-black text-lg tracking-tight">SafeDrive<span className="text-[#FF2A2A]">GPS</span></span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#planes" className="hidden sm:block text-sm text-zinc-400 hover:text-white transition-colors">Planes</a>
            <button data-testid="open-cart-button" onClick={() => setCartOpen(true)} className="relative p-2 text-zinc-300 hover:text-white">
              <ShoppingCart size={20} />
              {cart.length > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#FF2A2A] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-tel">{cart.length}</span>}
            </button>
            <Link to="/login" data-testid="nav-login-link" className="text-sm bg-white text-black font-bold px-4 py-2 rounded-md hover:bg-zinc-200 transition-colors">Acceso monitoristas</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO} alt="Camion de carga de noche" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/75" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent,#050505)" }} />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 py-28 lg:py-40">
          <div className="inline-flex items-center gap-2 border border-white/15 rounded-full px-3 py-1 text-xs font-tel text-zinc-300 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" /> Ecosistema Fronterizo · Nuevo Laredo
          </div>
          <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight max-w-3xl leading-[1.05]">
            Seguridad activa que <span className="text-[#FF2A2A]">previene</span> el robo y los accidentes en tiempo real.
          </h1>
          <p className="text-zinc-300 text-base md:text-lg mt-6 max-w-xl">
            No es un simple rastreador. SafeDrive GPS protege la vida del chofer, el patrimonio de la empresa y asegura los tiempos de cruce internacional.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <a href="#planes" data-testid="hero-plans-cta" className="bg-white text-black font-bold px-6 py-3 rounded-md hover:bg-zinc-200 transition-colors flex items-center gap-2">Ver planes <ArrowRight size={18} /></a>
            <Link to="/login" data-testid="hero-login-cta" className="border border-white/20 hover:border-white/50 font-bold px-6 py-3 rounded-md transition-colors">Centro de control</Link>
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 mb-3">Los 3 componentes</div>
        <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-10">Un ecosistema sincronizado</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: DeviceMobile, t: "App Móvil", s: "El Escudo del Operador", d: "Politica de cero distracciones, caja negra offline y boton de panico silencioso." },
            { icon: Cpu, t: "Backend Analítico", s: "El Cerebro", d: "Geoespacial con corredores de tolerancia, filtro de acelerometro e inteligencia de cobertura." },
            { icon: Monitor, t: "Dashboard Web", s: "Centro de Control Bento", d: "WebSockets en vivo, gestion por excepcion y difusion automatizada a autoridades." },
          ].map((c) => (
            <div key={c.t} className="card-tactical p-6">
              <c.icon size={28} weight="duotone" className="text-white mb-4" />
              <div className="font-heading font-bold text-lg">{c.t}</div>
              <div className="text-[#FF2A2A] text-xs font-tel uppercase tracking-wider mb-3">{c.s}</div>
              <p className="text-zinc-400 text-sm">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="card-tactical p-5 transition-colors">
              <f.icon size={24} weight="duotone" className="text-[#00E676] mb-3" />
              <div className="font-bold mb-1">{f.t}</div>
              <p className="text-zinc-400 text-sm">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Nuevo Laredo module */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="card-tactical p-8 lg:p-12 relative overflow-hidden">
          <Bridge size={120} weight="duotone" className="absolute -right-6 -bottom-6 text-[#007AFF]/10" />
          <div className="inline-flex items-center gap-2 text-[#007AFF] text-xs font-tel uppercase tracking-[0.2em] mb-4"><Bridge size={16} weight="fill" /> Factor Nuevo Laredo</div>
          <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight max-w-2xl">Módulo de Cruce Transfronterizo</h2>
          <p className="text-zinc-400 mt-4 max-w-2xl">Al entrar a la zona del Puente del Comercio Mundial o Puente 3, se activa una geocerca de <b className="text-white">Espera Fiscal</b>: pausa las alertas por estar detenido y cronometra con precision matematica las horas exactas en la fila. Metrica oro para agencias aduanales e importadores en EE.UU.</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="planes" className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 mb-3">Suscripciones</div>
        <h2 className="font-heading font-black text-2xl sm:text-3xl tracking-tight mb-2">Paquetes de capacidad</h2>
        <p className="text-zinc-400 mb-8 text-sm">Precios fijos por paquete. Si tienes menos choferes, el precio se mantiene.</p>

        <div className="inline-flex flex-wrap gap-1 border border-white/10 rounded-md p-1 mb-8">
          {CYCLES.map((c) => (
            <button key={c} data-testid={`cycle-${c}`} onClick={() => setCycle(c)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${cycle === c ? "bg-white text-black" : "text-zinc-400 hover:text-white"}`}>{c}</button>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} data-testid={`plan-${p.id}`}
              className={`card-tactical p-6 flex flex-col transition-all ${p.highlight ? "border-white/40 ring-1 ring-white/20" : ""}`}>
              {p.highlight && <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00E676] mb-2">Más popular</div>}
              <div className="font-heading font-black text-2xl">{p.name}</div>
              <div className="text-zinc-500 text-sm mt-1">{p.tagline}</div>
              <div className="mt-5 flex items-end gap-2">
                <span className="font-tel font-bold text-4xl">{mx(p.prices[cycle])}</span>
                <span className="text-zinc-500 text-sm mb-1">/ {cycle.toLowerCase()}</span>
              </div>
              <div className="text-xs text-zinc-500 font-tel mt-1">Hasta {p.devices} teléfonos · {p.per_truck}</div>
              <ul className="mt-5 space-y-2 text-sm flex-1">
                {["Monitoreo en tiempo real", "Geocercas de Nuevo Laredo", "Pánico silencioso + caja negra", "Cruce fiscal cronometrado"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-zinc-300"><Check size={15} className="text-[#00E676] shrink-0" /> {f}</li>
                ))}
              </ul>
              <button data-testid={`add-plan-${p.id}`} onClick={() => addToCart({ key: `plan-${p.id}`, name: `${p.name} (${cycle})`, price: p.prices[cycle] })}
                className={`mt-6 font-bold py-2.5 rounded-md transition-colors ${p.highlight ? "bg-white text-black hover:bg-zinc-200" : "border border-white/15 hover:border-white/50"}`}>
                Agregar al carrito
              </button>
            </div>
          ))}
        </div>

        {/* Onboarding */}
        <h3 className="font-heading font-bold text-lg mt-12 mb-4">Costo único inicial (Onboarding)</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {onboarding.map((o) => (
            <div key={o.id} data-testid={`onboarding-${o.id}`} className="card-tactical p-5 flex items-center justify-between gap-4">
              <div>
                <div className="font-bold">{o.name}</div>
                <p className="text-zinc-500 text-sm mt-1">{o.desc}</p>
                <div className="font-tel font-bold text-xl mt-2">{mx(o.price)}</div>
              </div>
              <button data-testid={`add-onboarding-${o.id}`} onClick={() => addToCart({ key: `onb-${o.id}`, name: o.name, price: o.price })}
                className="shrink-0 border border-white/15 hover:border-white/50 font-bold px-4 py-2 rounded-md text-sm transition-colors">Agregar</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-zinc-600 text-sm font-tel">
        SafeDrive GPS · Seguridad activa y telemetria en tiempo real · Nuevo Laredo, Tamps.
      </footer>

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div data-testid="cart-drawer" className="relative w-full max-w-md bg-[#0a0a0a] border-l border-white/10 h-full flex flex-col fade-up">
            <div className="px-5 h-16 flex items-center justify-between border-b border-white/10">
              <span className="font-heading font-bold flex items-center gap-2"><ShoppingCart size={18} /> Carrito</span>
              <button data-testid="close-cart-button" onClick={() => setCartOpen(false)} className="text-zinc-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 && <p className="text-zinc-600 text-sm text-center mt-10">Tu carrito esta vacio. Agrega un plan.</p>}
              {cart.map((i) => (
                <div key={i.key} className="card-tactical p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{i.name}</div>
                    <div className="font-tel text-zinc-400 text-sm">{mx(i.price)}</div>
                  </div>
                  <button data-testid={`remove-${i.key}`} onClick={() => removeFromCart(i.key)} className="text-zinc-500 hover:text-[#FF2A2A]"><X size={16} /></button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-sm uppercase tracking-wider">Total</span>
                <span data-testid="cart-total" className="font-tel font-bold text-2xl">{mx(total)}</span>
              </div>
              <p className="text-xs text-zinc-500">Procede tu compra y recibe la informacion del plan por WhatsApp o correo.</p>
              <button data-testid="checkout-whatsapp" onClick={orderWhatsApp} className="w-full bg-[#25D366] text-black font-bold py-3 rounded-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"><WhatsappLogo size={20} weight="fill" /> Pedir por WhatsApp</button>
              <button data-testid="checkout-email" onClick={orderEmail} className="w-full border border-white/15 hover:border-white/50 font-bold py-3 rounded-md flex items-center justify-center gap-2 transition-colors"><EnvelopeSimple size={20} /> Pedir por correo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
