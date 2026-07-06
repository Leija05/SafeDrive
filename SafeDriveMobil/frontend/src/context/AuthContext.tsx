import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";
import { apiFetch, setApiToken, setConflictHandler, ApiError } from "@/src/lib/api";

const TOKEN_KEY = "sd_token";
const DRIVER_TOKEN_KEY = "sd_driver_token";
const DEVICE_ID_KEY = "sd_device_id";

export type User = { id: string; email: string; name: string; role: string; phone?: string | null };
export type Unit = any;

type AuthState = {
  ready: boolean;
  token: string | null;
  user: User | null;
  unit: Unit | null;
  conflict: boolean;
  driverToken: string | null;
  driverTokenVerified: boolean;
  verifyDriverToken: (tok: string) => Promise<{ name: string; unit_id?: string }>;
  clearDriverToken: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, plate?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearConflict: () => void;
  refreshUnit: (u: Unit) => void;
};

const AuthContext = createContext<AuthState>({} as AuthState);

function getDeviceId(): string {
  // Stable pseudo-device-id from platform + install info
  const os = Platform.OS;
  const version = Platform.Version;
  return `dev-${os}-${String(version)}-${Date.now().toString(36)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [conflict, setConflict] = useState(false);
  const [driverToken, setDriverToken] = useState<string | null>(null);
  const [driverTokenVerified, setDriverTokenVerified] = useState(false);
  const loggingOut = useRef(false);

  const doLogout = useCallback(async (markConflict = false) => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setApiToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setUnit(null);
    if (markConflict) setConflict(true);
    loggingOut.current = false;
  }, []);

  useEffect(() => {
    setConflictHandler(() => doLogout(true));
    return () => setConflictHandler(null);
  }, [doLogout]);

  // Bootstrap from secure storage
  useEffect(() => {
    (async () => {
      const [saved, savedDt] = await Promise.all([
        storage.secureGet<string>(TOKEN_KEY, ""),
        storage.secureGet<string>(DRIVER_TOKEN_KEY, ""),
      ]);
      if (savedDt) {
        setDriverToken(savedDt);
        setDriverTokenVerified(true);
      }
      if (saved) {
        setApiToken(saved);
        try {
          const me = await apiFetch<User>("/auth/me");
          setToken(saved);
          setUser(me);
          if (me.role === "driver") {
            try {
              const u = await apiFetch("/driver/unit");
              setUnit(u);
            } catch {}
          }
        } catch (e) {
          await storage.secureRemove(TOKEN_KEY);
          setApiToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const persist = async (data: { access_token: string; user: User; unit?: Unit }) => {
    setApiToken(data.access_token);
    await storage.secureSet(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    if (data.unit) setUnit(data.unit);
    setConflict(false);
  };

  const verifyDriverToken = useCallback(async (tok: string) => {
    const deviceId = await storage.secureGet<string>(DEVICE_ID_KEY, "");
    const did = deviceId || getDeviceId();
    if (!deviceId) await storage.secureSet(DEVICE_ID_KEY, did);

    const data = await apiFetch<{ ok: boolean; name: string; unit_id?: string }>("/auth/verify-driver-token", {
      method: "POST",
      body: JSON.stringify({ token: tok.trim(), device_id: did }),
    });

    await storage.secureSet(DRIVER_TOKEN_KEY, tok.trim());
    setDriverToken(tok.trim());
    setDriverTokenVerified(true);
    return data;
  }, []);

  const clearDriverToken = useCallback(async () => {
    await storage.secureRemove(DRIVER_TOKEN_KEY);
    setDriverToken(null);
    setDriverTokenVerified(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const dt = await storage.secureGet<string>(DRIVER_TOKEN_KEY, "");
    const deviceId = await storage.secureGet<string>(DEVICE_ID_KEY, "");
    const body: Record<string, any> = { email: email.trim().toLowerCase(), password };
    if (dt) body.driver_token = dt;
    if (deviceId) body.device_id = deviceId;
    const data = await apiFetch<{ access_token: string; user: User; unit?: Unit }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
    await persist(data);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, plate?: string) => {
    const data = await apiFetch<{ access_token: string; user: User; unit?: Unit }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password, name, plate }),
    });
    await persist(data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    await doLogout(false);
  }, [doLogout]);

  return (
    <AuthContext.Provider
      value={{
        ready, token, user, unit, conflict,
        driverToken, driverTokenVerified,
        verifyDriverToken, clearDriverToken,
        login, register, logout,
        clearConflict: () => setConflict(false),
        refreshUnit: setUnit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
