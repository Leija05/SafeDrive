/**
 * @typedef {Object} Telemetry
 * @property {string=} unit_id
 * @property {number} lat
 * @property {number} lng
 * @property {number=} speed
 * @property {number=} heading
 * @property {number=} battery
 * @property {number=} g_force
 * @property {number=} g_duration_ms
 * @property {boolean=} signal_lost
 * @property {boolean=} panic
 * @property {string=} event
 * @property {string=} reason
 * @property {string=} ts
 */

/**
 * @typedef {Object} ChatIn
 * @property {string=} unit_id
 * @property {string} text
 * @property {boolean=} quick
 * @property {string=} sender
 */

import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");
export const API = `${BACKEND_URL.replace(/\/$/, "")}/api`;

export function getWsUrl() {
  const token = localStorage.getItem("sd_token");
  const url = new URL(`${BACKEND_URL.replace(/^http/, "ws")}/api/ws`);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sd_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Ocurrio un error. Intenta de nuevo.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;
