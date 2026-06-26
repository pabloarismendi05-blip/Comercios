import { Router } from "express";
import { prisma } from "../prisma.js";
import { claveFecha } from "../fecha.js";

export const cajaRouter = Router();

// Tipos de movimiento que el usuario puede cargar a mano desde la caja.
//   apertura = fondo de caja con el que arranca el día (suma).
//   gasto    = plata que sale para pagar algo (proveedor, compra). Resta.
//   retiro   = el dueño saca plata de la caja. Resta.
const TIPOS_MANUALES = ["apertura", "gasto", "retiro"];

// POST /api/caja/movimiento — registra un movimiento de efectivo a mano.
// Body: { tipo, monto, descripcion? }
cajaRouter.post("/caja/movimiento", async (req, res) => {
  const empresaId = req.empresaId;
  const tipo = String(req.body?.tipo ?? "").trim();
  const monto = Number(req.body?.monto);
  const descripcion = String(req.body?.descripcion ?? "").trim();

  if (!TIPOS_MANUALES.includes(tipo)) {
    return res.status(400).json({ error: "Tipo de movimiento inválido." });
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ error: "El monto tiene que ser mayor a cero." });
  }

  const porDefecto: Record<string, string> = {
    apertura: "Fondo de caja",
    gasto: "Gasto",
    retiro: "Retiro de caja",
  };

  const mov = await prisma.movimientoCaja.create({
    data: {
      empresaId,
      tipo,
      monto,
      descripcion: descripcion || porDefecto[tipo],
    },
  });

  res.status(201).json({
    ok: true,
    id: mov.id,
    tipo: mov.tipo,
    monto: Number(mov.monto),
    descripcion: mov.descripcion,
  });
});

// Calcula la "caja abierta" actual: todo lo que pasó DESPUÉS del último cierre.
// Si nunca se cerró, toma todo desde el principio. Así, las ventas que se hacen
// después de cerrar arrancan la caja siguiente y nunca quedan colgadas.
async function calcularCajaAbierta(empresaId: number) {
  const ultimo = await prisma.cierreCaja.findFirst({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
  });

  // Filtro de tiempo: estrictamente posterior al último cierre (si lo hay).
  const desde = ultimo ? ultimo.createdAt : null;
  const rango = desde ? { gt: desde } : undefined;
  const whereVenta = (medio: string) => ({
    empresaId,
    medioPago: medio,
    ...(rango ? { fechaHora: rango } : {}),
  });
  const whereMov = (tipo: string) => ({
    empresaId,
    tipo,
    ...(rango ? { fechaHora: rango } : {}),
  });

  const [
    vEfectivo,
    vTransferencia,
    vFiado,
    cobrosFiado,
    aperturas,
    gastos,
    retiros,
  ] = await Promise.all([
    prisma.venta.aggregate({ where: whereVenta("efectivo"), _sum: { total: true } }),
    prisma.venta.aggregate({ where: whereVenta("transferencia"), _sum: { total: true } }),
    prisma.venta.aggregate({ where: whereVenta("fiado"), _sum: { total: true } }),
    prisma.movimientoCaja.aggregate({ where: whereMov("cobro_fiado"), _sum: { monto: true } }),
    prisma.movimientoCaja.aggregate({ where: whereMov("apertura"), _sum: { monto: true } }),
    prisma.movimientoCaja.aggregate({ where: whereMov("gasto"), _sum: { monto: true } }),
    prisma.movimientoCaja.aggregate({ where: whereMov("retiro"), _sum: { monto: true } }),
  ]);

  const ventasEfectivo = Number(vEfectivo._sum.total ?? 0);
  const ventasTransferencia = Number(vTransferencia._sum.total ?? 0);
  const ventasFiado = Number(vFiado._sum.total ?? 0);
  const fiadoCobrado = Number(cobrosFiado._sum.monto ?? 0);
  const apertura = Number(aperturas._sum.monto ?? 0);
  const gasto = Number(gastos._sum.monto ?? 0);
  const retiro = Number(retiros._sum.monto ?? 0);

  // Solo el efectivo entra a la caja física.
  const efectivoEsperado = apertura + ventasEfectivo + fiadoCobrado - gasto - retiro;
  // Total vendido (lo facturado, sin importar cómo se cobró).
  const totalVendido = ventasEfectivo + ventasTransferencia + ventasFiado;

  // ¿Hay algo para cerrar? (Evita cierres en $0 por error.)
  const hayActividad =
    totalVendido > 0 || fiadoCobrado > 0 || apertura > 0 || gasto > 0 || retiro > 0;

  return {
    desde: desde ? desde.toISOString() : null,
    apertura,
    ventasEfectivo,
    ventasTransferencia,
    ventasFiado,
    cobrosFiado: fiadoCobrado,
    gastos: gasto,
    retiros: retiro,
    totalVendido,
    efectivoEsperado,
    hayActividad,
  };
}

function formatearCierre(c: {
  fecha: string;
  efectivoEsperado: unknown;
  efectivoContado: unknown;
  diferencia: unknown;
  createdAt: Date;
}) {
  return {
    fecha: c.fecha,
    efectivoEsperado: Number(c.efectivoEsperado),
    efectivoContado: Number(c.efectivoContado),
    diferencia: Number(c.diferencia),
    createdAt: c.createdAt.toISOString(),
  };
}

// GET /api/caja/cierre — estado de la caja: lo que está abierto ahora (desde el
// último cierre) + el último cierre hecho, para mostrar de referencia.
cajaRouter.get("/caja/cierre", async (req, res) => {
  const empresaId = req.empresaId;
  const [abierta, ultimo] = await Promise.all([
    calcularCajaAbierta(empresaId),
    prisma.cierreCaja.findFirst({ where: { empresaId }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({
    abierta,
    ultimoCierre: ultimo ? formatearCierre(ultimo) : null,
  });
});

// POST /api/caja/cierre — cierra la caja abierta: guarda lo contado y la
// diferencia. El esperado se recalcula en el server (no se confía en el cliente).
// Este cierre se vuelve el nuevo "corte": lo que venga después es otra caja.
// Body: { efectivoContado }
cajaRouter.post("/caja/cierre", async (req, res) => {
  const empresaId = req.empresaId;
  const efectivoContado = Number(req.body?.efectivoContado);

  if (!Number.isFinite(efectivoContado) || efectivoContado < 0) {
    return res.status(400).json({ error: "El efectivo contado no es válido." });
  }

  const abierta = await calcularCajaAbierta(empresaId);
  if (!abierta.hayActividad) {
    return res.status(400).json({ error: "No hay movimientos para cerrar en esta caja." });
  }

  const esperado = abierta.efectivoEsperado;
  const diferencia = efectivoContado - esperado;

  const cierre = await prisma.cierreCaja.create({
    data: {
      empresaId,
      fecha: claveFecha(new Date()),
      efectivoEsperado: esperado,
      efectivoContado,
      diferencia,
    },
  });

  res.status(201).json({ ok: true, ...formatearCierre(cierre) });
});
