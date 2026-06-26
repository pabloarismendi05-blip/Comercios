import express from "express";
import cors from "cors";
import { tenant } from "./middleware/tenant.js";
import { healthRouter } from "./routes/health.js";
import { productosRouter } from "./routes/productos.js";
import { clientesRouter } from "./routes/clientes.js";
import { ventasRouter } from "./routes/ventas.js";
import { resumenRouter } from "./routes/resumen.js";
import { cajaRouter } from "./routes/caja.js";

export function createApp() {
  const app = express();

  // CORS: en producción restringimos al dominio del front (variable FRONT_URL).
  // En desarrollo, si no está esa variable, permitimos cualquier origen.
  const frontUrl = process.env.FRONT_URL?.trim();
  app.use(cors(frontUrl ? { origin: frontUrl.split(",").map((u) => u.trim()) } : {}));

  app.use(express.json());

  // A partir de acá, toda request tiene req.empresaId resuelto por el server.
  app.use(tenant);

  app.use("/api", healthRouter);
  app.use("/api", resumenRouter);
  app.use("/api", productosRouter);
  app.use("/api", clientesRouter);
  app.use("/api", ventasRouter);
  app.use("/api", cajaRouter);

  return app;
}
