export type Telemetry = {
  unit_id?: string | null;
  lat: number;
  lng: number;
  speed?: number; // km/h
  heading?: number | null;
  battery?: number | null;
  g_force?: number | null;
  g_duration_ms?: number | null;
  signal_lost?: boolean;
  panic?: boolean;
  event?: string | null;
  reason?: string | null;
  ts?: string | null; // ISO timestamp
};

export type TelemetryBatch = {
  points: Telemetry[];
};

export type DistractionIn = {
  lat: number;
  lng: number;
  speed?: number;
  reason?: string;
  ts?: string;
};

export type ChatIn = {
  unit_id?: string | null;
  text: string;
  quick?: boolean;
  sender?: string | null; // 'driver' | 'base'
};

export type User = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  phone?: string | null;
};

export type Unit = {
  id: string;
  driver_id?: string | null;
  name?: string | null;
  driver_name?: string | null;
  plate?: string | null;
  imei?: string | null;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number | null;
  battery?: number | null;
  deviation_m?: number | null;
  status?: string | null;
  signal?: string | null;
  online?: boolean;
  panic?: boolean;
  assigned_route?: number[][];
  route_name?: string | null;
  route_tolerance_m?: number | null;
  trip_active?: boolean;
  last_update?: string | null;
  created_at?: string | null;
};

export type Alert = {
  id: string;
  unit_id?: string;
  type?: string;
  severity?: string;
  status?: string;
  created_at?: string;
};

export type RouteAssign = {
  route_id?: string | null;
  points?: number[][] | null;
  origin?: number[] | null;
  destination?: number[] | null;
  origin_address?: string | null;
  destination_address?: string | null;
  tolerance_m?: number | null;
  name?: string | null;
};

export default {};
