import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  ShieldCheck, Buildings, User, Truck, Key, SignOut, CaretDown, CaretUp,
  Plus, ChartBar, Clock, CheckCircle, XCircle, Eye, EyeSlash,
  Envelope, Lock, Phone, MapPin, IdentificationBadge, UsersThree,
  WarningCircle, CurrencyCircleDollar, Gear, ArrowLeft, PencilSimple,
  ArrowsLeftRight, Warning, Tag,
} from "@phosphor-icons/react";

const PLANS = [
  { id: "bronce", name: "Plan Bronce", devices: 10 },
  { id: "plata", name: "Plan Plata", devices: 25 },
  { id: "oro", name: "Plan Oro", devices: 50 },
];

const CYCLES = ["Semanal", "Mensual", "Bimestral", "Trimestral", "Anual"];

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [companyDetail, setCompanyDetail] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => { setTimeout(() => setAnimate(true), 100); }, []);

  useEffect(() => {
    if (user && user.role !== "superadmin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => { loadCompanies(); }, []);

  const loadCompanies = async () => {
    try {
      const { data } = await api.get("/auth/companies");
      setCompanies(data);
    } catch { toast.error("Error al cargar empresas"); }
  };

  const loadCompanyDetail = async (cid) => {
    if (companyDetail[cid]) return;
    try {
      const { data } = await api.get(`/auth/companies/${cid}`);
      setCompanyDetail((p) => ({ ...p, [cid]: data }));
    } catch { toast.error("Error al cargar detalle"); }
  };

  const toggleCompany = (cid) => {
    if (expanded === cid) { setExpanded(null); return; }
    setExpanded(cid);
    loadCompanyDetail(cid);
  };

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  const totalMonitoristas = companies.reduce((s, c) => s + (c.user_count || 0), 0);
  const totalUnits = companies.reduce((s, c) => s + (c.unit_count || 0), 0);
  const totalSubscriptions = companies.filter((c) => c.subscription?.expires_at).length;
  const expiredSubs = companies.filter((c) => c.subscription?.expires_at && new Date(c.subscription.expires_at) < new Date()).length;
  const noTokenCompanies = companies.filter((c) => c.has_token === false || c.subscription?.has_token === false).length;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-tel relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent pointer-events-none" />

      <div className={`relative max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 transition-all duration-700 ${animate ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldCheck size={24} weight="fill" className="text-black" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight">
                  SafeDrive<span className="text-amber-400">GPS</span>
                </h1>
                <span className="text-[10px] uppercase tracking-[0.2em] bg-amber-500/15 text-amber-400 px-2.5 py-1 rounded-full font-bold border border-amber-500/20">
                  SuperAdmin
                </span>
              </div>
              <p className="text-sm text-zinc-500 mt-0.5">
                {user?.email} — Panel de administración global
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
            >
              <Plus size={16} weight="bold" />
              Nueva empresa
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-xl text-sm transition-all"
            >
              <ChartBar size={16} />
              Monitoreo
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm transition-all"
            >
              <SignOut size={16} />
              Salir
            </button>
          </div>
        </div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-10">
          <StatCard icon={Buildings} label="Empresas" value={companies.length} gradient="from-blue-500 to-blue-600" delay={0} />
          <StatCard icon={User} label="Monitoristas" value={totalMonitoristas} gradient="from-violet-500 to-violet-600" delay={100} />
          <StatCard icon={Truck} label="Unidades" value={totalUnits} gradient="from-emerald-500 to-emerald-600" delay={200} />
          <StatCard icon={Key} label="Suscripciones" value={totalSubscriptions} gradient="from-amber-500 to-amber-600" delay={300} />
          <StatCard icon={WarningCircle} label="Vencidas" value={expiredSubs} gradient="from-red-500 to-red-600" delay={400} />
          <StatCard icon={Warning} label="Sin token" value={noTokenCompanies} gradient="from-amber-400 to-orange-500" delay={500} />
        </div>

        {/* ── Company List ── */}
        <div className="space-y-2.5">
          {companies.length === 0 && (
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                <Buildings size={32} className="text-zinc-600" />
              </div>
              <p className="text-xl font-bold text-zinc-400">No hay empresas registradas</p>
              <p className="text-zinc-600 text-sm mt-1">Crea la primera empresa para comenzar</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
              >
                <Plus size={16} weight="bold" />
                Crear primera empresa
              </button>
            </div>
          )}

          {companies.map((c, i) => (
            <CompanyCard
              key={c.id}
              company={c}
              expanded={expanded === c.id}
              detail={companyDetail[c.id]}
              onToggle={() => toggleCompany(c.id)}
              onRefresh={loadCompanies}
              index={i}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        {companies.length > 0 && (
          <div className="mt-12 pt-6 border-t border-zinc-800/50 flex items-center justify-between text-xs text-zinc-600">
            <span>SafeDriveGPS — Panel SuperAdmin</span>
            <span>{companies.length} empresas · {totalUnits} unidades</span>
          </div>
        )}
      </div>

      {showCreate && <CreateCompanyModal onClose={() => { setShowCreate(false); loadCompanies(); }} />}
      <Toaster position="top-right" theme="dark" />
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, gradient, delay }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 200 + delay); }, [delay]);

  return (
    <div className={`relative group transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="absolute -inset-0.5 bg-gradient-to-br from-zinc-800/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
      <div className="relative bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/[0.02] to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-zinc-500 uppercase tracking-[0.15em] font-semibold">{label}</p>
            <p className={`text-3xl font-black mt-1 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
              {value}
            </p>
          </div>
          <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-lg`}>
            <Icon size={18} weight="fill" className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Company Card ── */
function CompanyCard({ company, expanded, detail, onToggle, onRefresh, index }) {
  const [visible, setVisible] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100 + index * 80); }, [index]);

  const handleToggleActive = async () => {
    try {
      await api.patch(`/auth/companies/${company.id}`, { active: !company.active });
      toast.success(company.active ? "Empresa desactivada" : "Empresa activada");
      onRefresh();
    } catch { toast.error("Error al actualizar"); }
  };

  const sub = company.subscription;
  const hasNoToken = company.has_token === false || sub?.has_token === false;
  const hasDeactivatedToken = sub?.has_token === true && !sub?.active;
  const expired = sub?.expires_at ? new Date(sub.expires_at) < new Date() : false;
  const hasValidToken = sub?.expires_at && !expired && !hasNoToken && !hasDeactivatedToken;
  const users = detail?.users || [];
  const units = detail?.units || [];
  const availableUnits = units.filter((u) => !u.driver_id);

  return (
    <div className={`transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className={`bg-zinc-900/60 backdrop-blur-sm border rounded-2xl overflow-hidden transition-all duration-300 ${expanded ? "border-amber-500/30 shadow-lg shadow-amber-500/5" : company.active ? "border-zinc-800/60 hover:border-zinc-700/60" : "border-zinc-800/30 opacity-70"}`}>
        {/* ── Header ── */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-white/[0.02] transition-colors text-left group"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
              company.active
                ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-400 border border-emerald-500/20"
                : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50"
            }`}>
              {company.active ? <CheckCircle size={20} weight="fill" /> : <XCircle size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <p className="font-bold text-base truncate">{company.name}</p>
                {company.rfc && (
                  <span className="text-[10px] text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/50 hidden sm:inline">
                    {company.rfc}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                <span className="flex items-center gap-1"><User size={11} /> {users.length}</span>
                <span className="flex items-center gap-1"><Truck size={11} /> {units.length}</span>
                {company.email && <span className="hidden sm:block">{company.email}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {hasNoToken && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20">
                <Warning size={10} weight="fill" />
                Sin token
              </div>
            )}
            {hasDeactivatedToken && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                <XCircle size={10} weight="fill" />
                Inactivo
              </div>
            )}
            {hasValidToken && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {sub.plan_name || "Plan"}
              </div>
            )}
            {expired && sub && !hasNoToken && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full font-semibold bg-red-500/15 text-red-400 border border-red-500/20">
                <Warning size={10} weight="fill" />
                Vencido
              </div>
            )}
            <div className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>
              <CaretDown size={16} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </div>
          </div>
        </button>

        {/* ── Expanded Content ── */}
        {expanded && (
          <div className="border-t border-zinc-800/60 animate-fadeIn">
            <div className="p-4 lg:p-5 space-y-6">
              {/* Company meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetaItem icon={IdentificationBadge} label="RFC" value={company.rfc || "—"} />
                <MetaItem icon={Phone} label="Teléfono" value={company.phone || "—"} />
                <MetaItem icon={Envelope} label="Correo" value={company.email || "—"} />
                <MetaItem icon={MapPin} label="Dirección" value={company.address || "—"} />
              </div>

              {/* Token / Subscription info */}
              {hasNoToken && (
                <div className="flex items-center justify-between p-3 rounded-xl text-sm bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <Warning size={16} className="text-amber-400" />
                    <div>
                      <p className="font-semibold text-amber-400">Sin token de suscripcion</p>
                      <p className="text-xs text-zinc-500">
                        La empresa no tiene token asignado — usa el CLI <code className="text-zinc-300">generate_token.py</code> o el panel de tokens para asignarlo
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400">
                    SIN TOKEN
                  </span>
                </div>
              )}
              {hasDeactivatedToken && (
                <div className="flex items-center justify-between p-3 rounded-xl text-sm bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <XCircle size={16} className="text-red-400" />
                    <div>
                      <p className="font-semibold">{sub.plan_name || "Plan"}</p>
                      <p className="text-xs text-zinc-500">Token desactivado — activalo desde el panel de tokens</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400">
                    INACTIVO
                  </span>
                </div>
              )}
              {hasValidToken && (
                <div className="flex items-center justify-between p-3 rounded-xl text-sm bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <Key size={16} className="text-emerald-400" />
                    <div>
                      <p className="font-semibold">{sub.plan_name || "Plan"}</p>
                      <p className="text-xs text-zinc-500">
                        Válido hasta {new Date(sub.expires_at).toLocaleDateString("es-MX")} — Ciclo {sub.cycle || "Mensual"}
                        {sub.max_drivers && ` — ${sub.drivers_used || 0}/${sub.max_drivers} conductores`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                    ACTIVO
                  </span>
                </div>
              )}
              {expired && sub && !hasNoToken && (
                <div className="flex items-center justify-between p-3 rounded-xl text-sm bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <Warning size={16} className="text-red-400" />
                    <div>
                      <p className="font-semibold">{sub.plan_name || "Plan"}</p>
                      <p className="text-xs text-zinc-500">
                        Vencido — {new Date(sub.expires_at).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400">
                    VENCIDO
                  </span>
                </div>
              )}

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Monitoristas section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                      <UsersThree size={16} className="text-violet-400" />
                      Monitoristas ({users.filter((u) => u.role === "monitorista").length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {users.filter((u) => u.role === "monitorista").map((u) => (
                      <UserRow key={u.id} user={u} badge="monitorista" badgeColor="violet" onEdit={() => setEditUser(u)} />
                    ))}
                    {users.filter((u) => u.role === "monitorista").length === 0 && (
                      <EmptyRow text="Sin monitoristas" />
                    )}
                  </div>
                </div>

                {/* Conductores section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                      <User size={16} className="text-blue-400" />
                      Conductores ({users.filter((u) => u.role === "conductor" || u.role === "driver").length})
                    </h4>
                  </div>
                  <div className="space-y-1.5">
                    {users.filter((u) => u.role === "conductor" || u.role === "driver").map((u) => (
                      <UserRow key={u.id} user={u} badge={u.role} badgeColor="blue" onEdit={() => setEditUser(u)} />
                    ))}
                    {users.filter((u) => u.role === "conductor" || u.role === "driver").length === 0 && (
                      <EmptyRow text="Sin conductores" />
                    )}
                  </div>
                </div>

                {/* Units section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                      <Truck size={16} className="text-emerald-400" />
                      Unidades ({units.length}) <span className="text-zinc-600 font-normal">({availableUnits.length} disponibles)</span>
                    </h4>
                    <button
                      onClick={() => setShowCreateUnit(true)}
                      className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all font-semibold"
                    >
                      <Plus size={12} weight="bold" />
                      Nueva unidad
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {units.map((u) => (
                      <UnitRow key={u.id} unit={u} />
                    ))}
                    {units.length === 0 && <EmptyRow text="Sin unidades" />}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/40">
                <button
                  onClick={handleToggleActive}
                  className={`flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl font-semibold transition-all ${
                    company.active
                      ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                  }`}
                >
                  {company.active ? (
                    <><XCircle size={14} /> Desactivar empresa</>
                  ) : (
                    <><CheckCircle size={14} /> Activar empresa</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {editUser && (
        <EditUserModal
          user={editUser}
          companyName={company.name}
          companyId={company.id}
          units={units}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); onRefresh(); }}
        />
      )}
      {showCreateUnit && (
        <CreateUnitModal
          companyId={company.id}
          onClose={() => setShowCreateUnit(false)}
          onSaved={() => { setShowCreateUnit(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }) {
  return (
    <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-800/40">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <Icon size={12} />
        {label}
      </div>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}

function UserRow({ user, badge, badgeColor, onEdit }) {
  const colorMap = {
    violet: "bg-violet-500/15 text-violet-400 border-violet-500/20",
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  };
  return (
    <div className="flex items-center justify-between bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl px-3.5 py-2.5 transition-colors group border border-zinc-800/40">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-400 shrink-0">
          {user.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 ${colorMap[badgeColor] || colorMap.violet}`}>
          {badge}
        </span>
        <button onClick={onEdit} className="w-7 h-7 rounded-lg bg-zinc-700/30 hover:bg-amber-500/20 hover:text-amber-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-zinc-700/40 hover:border-amber-500/30 text-zinc-500">
          <PencilSimple size={13} />
        </button>
      </div>
    </div>
  );
}

function UnitRow({ unit, onAssign }) {
  const statusColors = {
    en_ruta: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    alerta: "bg-red-500/15 text-red-400 border-red-500/20",
    detenido: "bg-zinc-600/30 text-zinc-400 border-zinc-600/30",
    cruce_fiscal: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    offline: "bg-zinc-700/30 text-zinc-500 border-zinc-700/30",
  };
  const statusLabel = {
    en_ruta: "En ruta", alerta: "Alerta", detenido: "Detenido", cruce_fiscal: "Cruce fiscal", offline: "Sin señal",
  };
  const sc = statusColors[unit.status] || statusColors.detenido;
  const inUse = !!unit.driver_id;

  return (
    <div className="flex items-center justify-between bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl px-3.5 py-2.5 transition-colors group border border-zinc-800/40">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 border ${inUse ? 'bg-emerald-700/30 text-emerald-400 border-emerald-500/10' : 'bg-zinc-700/30 text-zinc-500 border-zinc-700/40'}`}>
          {unit.name?.slice(0, 2) || "UN"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{unit.name} <span className="text-zinc-500 font-normal">{unit.plate}</span></p>
          {unit.driver_name ? (
            <p className="text-xs text-zinc-500 truncate">{unit.driver_name}</p>
          ) : (
            <p className="text-xs text-zinc-600 italic truncate">Disponible</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {inUse && (
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${sc}`}>
            {statusLabel[unit.status] || unit.status || "Detenido"}
          </span>
        )}
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${inUse ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-zinc-700/30 text-zinc-400 border-zinc-700/40'}`}>
          {inUse ? 'En uso' : 'Libre'}
        </span>
      </div>
    </div>
  );
}

function EmptyRow({ text }) {
  return (
    <div className="flex items-center justify-center py-6 text-sm text-zinc-600 bg-zinc-800/10 rounded-xl border border-dashed border-zinc-800/40">
      {text}
    </div>
  );
}

/* ── Edit User Modal ── */
function EditUserModal({ user, companyName, companyId, units = [], onClose, onSaved }) {
  const isDriver = user.role === "conductor" || user.role === "driver";
  const currentUnit = units.find((u) => u.driver_id === user.id);
  const [form, setForm] = useState({ name: user.name || "", email: user.email || "", password: "" });
  const [unitId, setUnitId] = useState(currentUnit?.id || "");
  const [siteToken, setSiteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!siteToken.trim()) {
      toast.error("Ingresa el token de acceso de la empresa para confirmar");
      return;
    }
    const payload = {};
    if (form.name !== user.name) payload.name = form.name;
    if (form.email !== user.email) payload.email = form.email;
    if (form.password) payload.password = form.password;
    payload.site_token = siteToken.trim();

    if (Object.keys(payload).length <= 1 && !unitId) {
      toast.error("No hay cambios para guardar");
      return;
    }

    setBusy(true);
    try {
      if (Object.keys(payload).length > 1) {
        await api.patch(`/auth/users/${user.id}`, payload);
      }
      // Reassign unit if changed
      if (unitId && unitId !== (currentUnit?.id || "")) {
        await api.put(`/users/${user.id}/assign-unit`, { unit_id: unitId });
      }
      toast.success("Usuario actualizado correctamente");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al actualizar usuario");
    } finally { setBusy(false); }
  };

  const availableUnits = units.filter((u) => !u.driver_id || u.driver_id === user.id);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl shadow-black/50 animate-fadeIn">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <User size={20} weight="fill" className="text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Editar usuario</h2>
              <p className="text-xs text-zinc-500">{companyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-colors border border-zinc-700/50">
            <XCircle size={16} className="text-zinc-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <InputField icon={IdentificationBadge} label="Nombre" name="name" value={form.name} onChange={handleChange} placeholder="Nombre completo" />
          <InputField icon={Envelope} label="Correo electrónico" name="email" type="email" value={form.email} onChange={handleChange} placeholder="correo@empresa.com" />
          <div className="relative">
            <InputField icon={Lock} label="Nueva contraseña (dejar vacío para no cambiar)" name="password" type={showPw ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="••••••••" />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 bottom-2.5 text-zinc-500 hover:text-zinc-300 transition-colors">
              {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {isDriver && (
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block font-medium flex items-center gap-1.5">
                <Truck size={13} className="text-emerald-400" />
                Unidad asignada
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700/60 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-sm outline-none transition-all text-white"
              >
                <option value="">Seleccionar unidad...</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.plate}{u.driver_id ? ' (en uso por este conductor)' : ' (disponible)'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1.5">Cambiar la unidad liberará la anterior automáticamente.</p>
            </div>
          )}

          <div className="border-t border-zinc-800/40 pt-4">
            <label className="text-xs text-zinc-400 mb-1.5 block font-medium flex items-center gap-1.5">
              <Key size={13} className="text-amber-400" />
              Token de acceso de la empresa <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={siteToken}
              onChange={(e) => setSiteToken(e.target.value)}
              placeholder="Pega el token de suscripción de la empresa"
              className="w-full bg-zinc-800/80 border border-zinc-700/60 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm outline-none transition-all text-white placeholder-zinc-600"
            />
            <p className="text-[11px] text-zinc-600 mt-1.5">Necesitas el token de suscripción de la empresa para confirmar los cambios.</p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/40">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors border border-zinc-700/50">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50">
              {busy ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ── Create Company Modal ── */
function CreateCompanyModal({ onClose }) {
  const [form, setForm] = useState({
    name: "", rfc: "", phone: "", email: "", address: "",
    monitor_email: "", monitor_password: "", monitor_name: "",
    plan_id: "plata", cycle: "Mensual",
  });
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState(0);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.monitor_email || !form.monitor_password || !form.monitor_name) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/auth/companies", form);
      const hasToken = data.site_token ? "con token incluido" : "sin token (debes asignarlo manualmente)";
      toast.success(`Empresa creada exitosamente — ${hasToken}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear empresa");
    } finally { setBusy(false); }
  };

  const selectedPlan = PLANS.find((p) => p.id === form.plan_id);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Buildings size={20} weight="fill" className="text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nueva empresa</h2>
              <p className="text-xs text-zinc-500">Registra una empresa y su monitorista inicial</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-colors border border-zinc-700/50">
            <XCircle size={16} className="text-zinc-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {step === 0 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-zinc-500 uppercase tracking-[0.15em] font-bold flex items-center gap-2">
                <Buildings size={14} /> Datos de la empresa
              </p>
              <InputField icon={IdentificationBadge} label="Nombre *" name="name" value={form.name} onChange={handleChange} placeholder="Transportes NLD, S.A. de C.V." />
              <div className="grid grid-cols-2 gap-3">
                <InputField icon={Gear} label="RFC" name="rfc" value={form.rfc} onChange={handleChange} placeholder="XXX000101XXX" />
                <InputField icon={Phone} label="Teléfono" name="phone" value={form.phone} onChange={handleChange} placeholder="+52 867 000 0000" />
              </div>
              <InputField icon={Envelope} label="Correo" name="email" type="email" value={form.email} onChange={handleChange} placeholder="contacto@empresa.com" />
              <InputField icon={MapPin} label="Dirección" name="address" value={form.address} onChange={handleChange} placeholder="Calle, colonia, ciudad..." />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-zinc-500 uppercase tracking-[0.15em] font-bold flex items-center gap-2">
                <Tag size={14} /> Plan de suscripcion
              </p>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Plan *</label>
                <div className="grid gap-2">
                  {PLANS.map((p) => (
                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      form.plan_id === p.id
                        ? "bg-amber-500/10 border-amber-500/40"
                        : "bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600/50"
                    }`}>
                      <input type="radio" name="plan_id" value={p.id} checked={form.plan_id === p.id}
                        onChange={handleChange} className="accent-amber-500" />
                      <div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-zinc-500">{p.devices} conductores</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Ciclo de facturacion</label>
                <select name="cycle" value={form.cycle} onChange={handleChange}
                  className="w-full bg-zinc-800/80 border border-zinc-700/60 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm outline-none transition-all text-white">
                  {CYCLES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs text-zinc-400">
                <p className="font-semibold text-emerald-400 mb-1">El token se creara automaticamente</p>
                <p>Al seleccionar un plan, la empresa recibira su token de monitorista unico al momento de crearse.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <p className="text-xs text-zinc-500 uppercase tracking-[0.15em] font-bold flex items-center gap-2">
                <User size={14} /> Monitorista inicial
              </p>
              <InputField icon={IdentificationBadge} label="Nombre del monitorista *" name="monitor_name" value={form.monitor_name} onChange={handleChange} placeholder="Hector Leija" />
              <InputField icon={Envelope} label="Correo del monitorista *" name="monitor_email" type="email" value={form.monitor_email} onChange={handleChange} placeholder="monitor@empresa.com" />
              <div className="relative">
                <InputField icon={Lock} label="Contrasena del monitorista *" name="monitor_password" type={showPw ? "text" : "password"} value={form.monitor_password} onChange={handleChange} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 bottom-2.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="bg-zinc-800/30 rounded-xl p-3 text-xs text-zinc-400">
                <p className="font-semibold text-zinc-300 mb-1">Resumen</p>
                <p>Empresa: <span className="text-zinc-200">{form.name}</span></p>
                <p>Plan: <span className="text-zinc-200">{selectedPlan?.name} ({selectedPlan?.devices} cond.) — {form.cycle}</span></p>
                <p className="text-emerald-400 mt-1">El token de monitorista se generara automaticamente.</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-800/40">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                <ArrowLeft size={14} /> Anterior
              </button>
            ) : <div />}
            <div className="flex gap-2">
              {step < 2 ? (
                <button type="button" onClick={() => setStep(step + 1)} className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors border border-zinc-700/50">
                  Siguiente
                </button>
              ) : (
                <button type="submit" disabled={busy} className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50">
                  {busy ? "Creando..." : "Crear empresa"}
                </button>
              )}
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex justify-center gap-2 pt-1">
            <div className={`w-2 h-2 rounded-full transition-all ${step === 0 ? "bg-amber-400 w-6" : "bg-zinc-700"}`} />
            <div className={`w-2 h-2 rounded-full transition-all ${step === 1 ? "bg-amber-400 w-6" : "bg-zinc-700"}`} />
            <div className={`w-2 h-2 rounded-full transition-all ${step === 2 ? "bg-amber-400 w-6" : "bg-zinc-700"}`} />
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Create Unit Modal ── */
function CreateUnitModal({ companyId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", plate: "", imei: "", color: "#00E676" });
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.plate.trim()) {
      toast.error("Nombre y placas son obligatorios");
      return;
    }
    setBusy(true);
    try {
      await api.post("/units", { ...form, company_id: companyId });
      toast.success("Unidad creada correctamente");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear unidad");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl shadow-black/50 animate-fadeIn">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Truck size={20} weight="fill" className="text-black" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nueva unidad</h2>
              <p className="text-xs text-zinc-500">Registra una nueva unidad con placas</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 flex items-center justify-center transition-colors border border-zinc-700/50">
            <XCircle size={16} className="text-zinc-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <InputField icon={IdentificationBadge} label="Nombre de la unidad *" name="name" value={form.name} onChange={handleChange} placeholder="NL-01" />
          <InputField icon={Gear} label="Placas *" name="plate" value={form.plate} onChange={handleChange} placeholder="XXX-00-00" />
          <InputField icon={Gear} label="IMEI (opcional)" name="imei" value={form.imei} onChange={handleChange} placeholder="Identificador del dispositivo GPS" />
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Color en mapa</label>
            <input type="color" name="color" value={form.color} onChange={handleChange} className="w-full h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 cursor-pointer" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/40">
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm transition-colors border border-zinc-700/50">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">
              {busy ? "Creando..." : "Crear unidad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InputField({ icon: Icon, label, name, type = "text", value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1.5 block font-medium">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Icon size={15} />
          </div>
        )}
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full bg-zinc-800/80 border border-zinc-700/60 focus:border-amber-500/50 rounded-xl px-3 py-2.5 text-sm outline-none transition-all text-white placeholder-zinc-600 ${Icon ? "pl-9" : ""}`}
        />
      </div>
    </div>
  );
}
