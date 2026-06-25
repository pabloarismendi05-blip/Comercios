import { Request, Response, NextFunction } from "express";

// ── REGLA DURA: el empresa_id se resuelve SIEMPRE en el servidor ──
//
// Hoy todavía no hay login. Para poder probar, tomamos el empresa_id de un
// header (X-Empresa-Id) o, si no viene, usamos la empresa 1 (la de testing).
//
// IMPORTANTE: cuando agreguemos autenticación (etapa futura), el empresa_id
// saldrá del token de sesión y NUNCA del cliente. Este middleware es el único
// lugar donde se decide, así que el resto del código ya queda blindado.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      empresaId: number;
    }
  }
}

export function tenant(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("X-Empresa-Id");
  const parsed = header ? Number(header) : NaN;
  req.empresaId = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  next();
}
