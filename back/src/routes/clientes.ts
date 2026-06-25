import { Router } from "express";
import { prisma } from "../prisma.js";

export const clientesRouter = Router();

// Listar / buscar clientes. Por defecto ordenados por quién debe más.
clientesRouter.get("/clientes", async (req, res) => {
  const empresaId = req.empresaId;
  const q = String(req.query.q ?? "").trim();

  const where = q ? { empresaId, nombre: { contains: q } } : { empresaId };

  const clientes = await prisma.cliente.findMany({
    where,
    take: 200,
    orderBy: [{ saldo: "desc" }, { nombre: "asc" }],
  });

  res.json(
    clientes.map((c) => ({ id: c.id, nombre: c.nombre, saldo: Number(c.saldo) }))
  );
});

// Detalle de un cliente: su saldo + historial de compras fiadas y pagos.
clientesRouter.get("/clientes/:id", async (req, res) => {
  const empresaId = req.empresaId;
  const id = Number(req.params.id);

  const cliente = await prisma.cliente.findFirst({ where: { id, empresaId } });
  if (!cliente) return res.status(404).json({ error: "El cliente no existe." });

  const [compras, pagos] = await Promise.all([
    prisma.venta.findMany({
      where: { empresaId, clienteId: id, medioPago: "fiado" },
      orderBy: { fechaHora: "desc" },
    }),
    prisma.movimientoCaja.findMany({
      where: { empresaId, clienteId: id, tipo: "cobro_fiado" },
      orderBy: { fechaHora: "desc" },
    }),
  ]);

  // Línea de tiempo unificada (compras suman deuda, pagos la bajan).
  const historial = [
    ...compras.map((v) => ({
      tipo: "compra" as const,
      fecha: v.fechaHora,
      monto: Number(v.total),
    })),
    ...pagos.map((m) => ({
      tipo: "pago" as const,
      fecha: m.fechaHora,
      monto: Number(m.monto),
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  res.json({
    id: cliente.id,
    nombre: cliente.nombre,
    saldo: Number(cliente.saldo),
    historial,
  });
});

// Crear cliente.
clientesRouter.post("/clientes", async (req, res) => {
  const empresaId = req.empresaId;
  const nombre = String(req.body?.nombre ?? "").trim();
  if (!nombre) return res.status(400).json({ error: "El nombre del cliente es obligatorio." });

  const cliente = await prisma.cliente.create({ data: { empresaId, nombre, saldo: 0 } });
  res.status(201).json({ id: cliente.id, nombre: cliente.nombre, saldo: 0 });
});

// Editar cliente (por ahora, el nombre).
clientesRouter.put("/clientes/:id", async (req, res) => {
  const empresaId = req.empresaId;
  const id = Number(req.params.id);
  const nombre = String(req.body?.nombre ?? "").trim();
  if (!nombre) return res.status(400).json({ error: "El nombre del cliente es obligatorio." });

  const existe = await prisma.cliente.findFirst({ where: { id, empresaId } });
  if (!existe) return res.status(404).json({ error: "El cliente no existe." });

  const cliente = await prisma.cliente.update({ where: { id }, data: { nombre } });
  res.json({ id: cliente.id, nombre: cliente.nombre, saldo: Number(cliente.saldo) });
});

// Registrar un PAGO de fiado. Atómico: baja el saldo Y registra el movimiento
// de caja (entra plata), todo junto o nada.
clientesRouter.post("/clientes/:id/pagos", async (req, res) => {
  const empresaId = req.empresaId;
  const id = Number(req.params.id);
  const monto = Number(req.body?.monto);

  if (!Number.isFinite(monto) || monto <= 0) {
    return res.status(400).json({ error: "El monto del pago tiene que ser mayor a cero." });
  }

  const cliente = await prisma.cliente.findFirst({ where: { id, empresaId } });
  if (!cliente) return res.status(404).json({ error: "El cliente no existe." });

  const saldoActual = Number(cliente.saldo);
  if (monto > saldoActual) {
    return res.status(400).json({
      error: `El pago ($${monto}) no puede ser mayor a la deuda ($${saldoActual}).`,
    });
  }

  try {
    const nuevoSaldo = await prisma.$transaction(async (tx) => {
      const c = await tx.cliente.update({
        where: { id },
        data: { saldo: { decrement: monto } },
      });
      await tx.movimientoCaja.create({
        data: {
          empresaId,
          tipo: "cobro_fiado",
          monto,
          descripcion: `Pago de fiado — ${cliente.nombre}`,
          clienteId: id,
        },
      });
      return Number(c.saldo);
    });

    res.status(201).json({ ok: true, saldo: nuevoSaldo });
  } catch (err) {
    res.status(500).json({ error: "No se pudo registrar el pago." });
  }
});
