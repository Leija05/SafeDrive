import Constants from "expo-constants";
import { Platform } from "react-native";

function normalizeBaseUrl(url?: string | null) {
  return url ? url.replace(/\/$/, "") : "";
}

function getDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    (Constants.manifest as any)?.debuggerHost;

  if (!hostUri) return "";
  const host = String(hostUri).split(":")[0];
  return host ? `http://${host}:8000` : "";
}

function getDefaultBaseUrl() {
  const fromEnv = normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL);
  if (fromEnv) return fromEnv;

  const fromExpoHost = getDevHost();
  if (fromExpoHost) return fromExpoHost;

  // Android emulators cannot reach the host machine through localhost.
  if (Platform.OS === "android") return "http://10.0.2.2:8000";

  return "http://localhost:8000";
}

const BASE = getDefaultBaseUrl();

let _token: string | null = null;
let _onConflict: (() => void) | null = null;

export function setApiToken(t: string | null) {
  _token = t;
}

export function setConflictHandler(fn: (() => void) | null) {
  _onConflict = fn;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (_token) headers.Authorization = `Bearer ${_token}`;

  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });

  if (res.status === 409) {
    // Session taken over by another device.
    if (_onConflict) _onConflict();
  }

  if (!res.ok) {
    let msg = "Error de conexión";
    try {
      const j = await res.json();
      msg = j.detail || msg;
    } catch {}
    throw new ApiError(msg, res.status);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export function getWsUrl() {
  const token = _token;
  const url = new URL(`${BASE.replace(/^http/, "ws")}/api/ws`);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}
