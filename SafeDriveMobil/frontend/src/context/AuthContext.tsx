import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { storage } from "@/src/utils/storage";
import { apiFetch, setApiToken, setConflictHandler, ApiError } from "@/src/lib/api";

const TOKEN_KEY = "sd_token";

export type User = { id: string; email: string; name: string; role: string; phone?: string | null };
export type Unit = any;

type AuthState = {
  ready: boolean;
  token: string | null;
  user: User | null;
  unit: Unit | null;
  conflict: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, plate?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearConflict: () => void;
  refreshUnit: (u: Unit) => void;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [conflict, setConflict] = useState(false);
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
      const saved = await storage.secureGet<string>(TOKEN_KEY, "");
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

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: User; unit?: Unit }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
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
        ready, token, user, unit, conflict, login, register, logout,
        clearConflict: () => setConflict(false),
        refreshUnit: setUnit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
