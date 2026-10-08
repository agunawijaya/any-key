/** Numbers as the instruments and the result cards show them. */

export function fmtAlt(km: number) {
  if (km >= 100) return `${Math.round(km)} km`;
  if (km >= 10) return `${km.toFixed(1)} km`;
  if (km >= 1) return `${km.toFixed(2)} km`;
  if (km >= 0.01) return `${Math.round(km * 1000)} m`;
  return `${(km * 1000).toFixed(1)} m`;
}

export function fmtSpeed(v: number) {
  const a = Math.abs(v);
  return a >= 100 ? `${Math.round(a).toLocaleString("en-US")} km/h` : `${a.toFixed(1)} km/h`;
}

export function fmtKm(km: number) {
  const a = Math.abs(km);
  return a >= 10 ? `${Math.round(a)} km` : a >= 1 ? `${a.toFixed(1)} km` : `${Math.round(a * 1000)} m`;
}
