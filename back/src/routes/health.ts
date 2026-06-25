import { Router } from "express";
import { prisma } from "../prisma.js";

export const healthRouter = Router();

// Verifica que el server responde Y que la base de datos contesta.
healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "ok" });
  } catch (err) {
    res.status(500).json({ ok: false, db: "error", detalle: String(err) });
  }
});
