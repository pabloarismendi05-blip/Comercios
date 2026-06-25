// Helpers de fecha en hora LOCAL del server (Argentina).
// Importante: trabajamos siempre con la fecha local, no UTC, para que "hoy"
// signifique el día calendario del kiosquero.

export function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

// Clave AAAA-MM-DD en hora local (sirve para agrupar por día y para el <input type=date>).
export function claveFecha(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Convierte "AAAA-MM-DD" a un Date al inicio de ese día local.
// Si el texto no es válido, devuelve el inicio de hoy.
export function desdeClave(fecha: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return inicioDelDia(new Date());
}
