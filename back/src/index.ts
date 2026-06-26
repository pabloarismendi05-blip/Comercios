// El servidor tiene que razonar las fechas en hora de Argentina, no en UTC.
// En Render el proceso corre en UTC (3 hs adelante), y eso hacía que las ventas
// de la tarde/noche cayeran en el día siguiente. Fijando la zona, "hoy" coincide
// con el día real del kiosco en el historial, el resumen y el cierre de caja.
process.env.TZ = process.env.TZ || "America/Argentina/Buenos_Aires";

import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`🛒 Kiosco API escuchando en http://localhost:${PORT}`);
  console.log(`   Probá: http://localhost:${PORT}/api/health`);
});
