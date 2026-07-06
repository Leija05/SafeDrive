import { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const STORAGE_SITE_TOKEN = "sd_site_token";
const STORAGE_AUTH_TOKEN = "sd_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteToken, setSiteToken] = useState(() => localStorage.getItem(STORAGE_SITE_TOKEN));

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_AUTH_TOKEN);
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem(STORAGE_AUTH_TOKEN))
      .finally(() => setLoading(false));
  }, []);

  const verifySiteToken = async (token) => {
    const { data } = await api.post("/auth/verify-site-token", { token });
    localStorage.setItem(STORAGE_SITE_TOKEN, token);
    setSiteToken(token);
    return data;
  };

  const clearSiteToken = () => {
    localStorage.removeItem(STORAGE_SITE_TOKEN);
    setSiteToken(null);
  };

  const login = async (email, password) => {
    const payload = { email, password };
    if (siteToken) payload.site_token = siteToken;
    const { data } = await api.post("/auth/login", payload);
    localStorage.setItem(STORAGE_AUTH_TOKEN, data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_AUTH_TOKEN);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, siteToken, login, logout, verifySiteToken, clearSiteToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
