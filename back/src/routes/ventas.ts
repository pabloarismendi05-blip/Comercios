import { Router } from "express";
import { prisma } from "../prisma.js";
import { claveFecha, desdeClave } from "../fecha.js";

export const ventasRouter = Router();

const MEDIOS_VALIDOS = ["efectivo", "transferencia", "fiado"];

// GET /api/ventas?fecha=AAAA-MM-DD — ventas de un día (por defecto, hoy).
// Solo lectura: lista de la más nueva a la más vieja, con el total del día.
ventasRouter.get("/ventas", async (req, res) => {
  const empresaId = req.empresaId;
  const base = desdeClave(String(req.query.fecha ?? ""));
  const fin = new Date(base);
  fin.setDate(fin.getDate() + 1);

  const ventas = await prisma.venta.findMany({
    where: { empresaId, fechaHora: { gte: base, lt: fin } },
    orderBy: { fechaHora: "desc" },
    include: { cliente: true },
  });

  // El total del día suma SOLO las ventas vigentes (las anuladas no cuentan),
  // pero las anuladas igual se listan (tachadas) para que quede el registro.
  const vigentes = ventas.filter((v) => v.anuladaEn === null);
  const total = vigentes.reduce((acc, v) => acc + Number(v.total), 0);

  res.json({
    fecha: claveFecha(base),
    total,
    cantidad: vigentes.length,
    ventas: ventas.map((v) => ({
      id: v.id,
      fechaHora: v.fechaHora,
      total: Number(v.total),
      medioPago: v.medioPago,
      clienteNombre: v.cliente ? v.cliente.nombre : null,
      anulada: v.anuladaEn !== null,
    })),
  });
});

// GET /api/ventas/:id — detalle de una venta (qué se vendió).
ventasRouter.get("/ventas/:id", async (req, res) => {
  const empresaId = req.empresaId;
  const id = Number(req.params.id);

  const venta = await prisma.venta.findFirst({
    where: { id, empresaId },
    include: { cliente: true, items: { include: { producto: true } } },
  });
  if (!venta) return res.status(404).json({ error: "La venta no existe." });

  res.json({
    id: venta.id,
    fechaHora: venta.fechaHora,
    total: Number(venta.total),
    medioPago: venta.medioPago,
    clienteNombre: venta.cliente ? venta.cliente.nombre : null,
    anulada: venta.anuladaEn !== null,
    anuladaEn: venta.anuladaEn,
    motivoAnulacion: venta.motivoAnulacion,
    items: venta.items.map((it) => ({
      // Nombre del producto, o la descripción si fue un ítem manual.
      nombre: it.producto ? it.producto.nombre : it.descripcion ?? "Varios",
      cantidad: it.cantidad,
      precioUnitario: Number(it.precioUnitario),
      subtotal: Number(it.precioUnitario) * it.cantidad,
    })),
  });
});

type ItemInput = {
  productoId?: number | null;
  cantidad: number;
  // Solo para ítems manuales ("venta rápida"):
  precioUnitario?: number;
  descripcion?: string;
};

// POST /api/ventas — registra una venta completa.
//
// Diseño en dos fases a propósito:
//   1) VALIDAR todo ANTES de abrir la transacción (stock, montos, cliente).
//      Si algo falla, no se tocó nada y el mensaje es claro.
//   2) Recién con todo validado, abrir UNA transacción que hace todo o nada:
//      Venta + VentaItem + descuento de stock + MovimientoCaja (+ saldo si es fiado).
ventasRouter.post("/ventas", async (req, res) => {
  const empresaId = req.empresaId;
  const { items, medioPago, clienteId } = (req.body ?? {}) as {
    items: ItemInput[];
    medioPago: string;
    clienteId?: number | null;
  };

  // ── Validaciones previas ──
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "El ticket está vacío." });
  }
  if (!MEDIOS_VALIDOS.includes(medioPago)) {
    return res.status(400).json({ error: "Medio de pago inválido." });
  }
  for (const it of items) {
    if (!Number.isInteger(it.cantidad) || it.cantidad <= 0) {
      return res.status(400).json({ error: "Hay un ítem con cantidad inválida." });
    }
  }

  // Cliente obligatorio si es fiado.
  let cliente = null;
  if (medioPago === "fiado") {
    if (!clienteId) {
      return res.status(400).json({ error: "Para vender fiado tenés que elegir un cliente." });
    }
    cliente = await prisma.cliente.findFirst({ where: { id: clienteId, empresaId } });
    if (!cliente) {
      return res.status(400).json({ error: "El cliente seleccionado no existe." });
    }
  }

  // Cargar los productos involucrados (de esta empresa) para validar stock y
  // tomar el precio DEL MOMENTO.
  const productoIds = items
    .map((i) => i.productoId)
    .filter((id): id is number => typeof id === "number");
  const productos = productoIds.length
    ? await prisma.producto.findMany({ where: { id: { in: productoIds }, empresaId } })
    : [];
  const mapaProd = new Map(productos.map((p) => [p.id, p]));

  // Armar las líneas finales y el total, validando stock.
  const lineas: {
    productoId: number | null;
    descripcion: string | null;
    cantidad: number;
    precioUnitario: number;
  }[] = [];
  let total = 0;

  for (const it of items) {
    if (typeof it.productoId === "number") {
      const p = mapaProd.get(it.productoId);
      if (!p) {
        return res.status(400).json({ error: "Un producto del ticket ya no existe." });
      }
      if (p.stockActual < it.cantidad) {
        return res.status(409).json({
          error: `No hay stock suficiente de "${p.nombre}" (quedan ${p.stockActual}).`,
        });
      }
      const precio = Number(p.precioVenta); // precio congelado al momento
      lineas.push({ productoId: p.id, descripcion: null, cantidad: it.cantidad, precioUnitario: precio });
      total += precio * it.cantidad;
    } else {
      // Ítem manual / venta rápida.
      const precio = Number(it.precioUnitario);
      if (!Number.isFinite(precio) || precio <= 0) {
        return res.status(400).json({ error: "El monto de la venta rápida no es válido." });
      }
      lineas.push({
        productoId: null,
        descripcion: (it.descripcion ?? "Varios").trim() || "Varios",
        cantidad: it.cantidad,
        precioUnitario: precio,
      });
      total += precio * it.cantidad;
    }
  }

  if (total <= 0) {
    return res.status(400).json({ error: "El total tiene que ser mayor a cero." });
  }

  // ── Transacción atómica: todo o nada ──
  try {
    const ventaId = await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.create({
        data: {
          empresaId,
          total,
          medioPago,
          clienteId: cliente ? cliente.id : null,
          items: {
            create: lineas.map((l) => ({
              productoId: l.productoId,
              descripcion: l.descripcion,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
            })),
          },
        },
      });

      // Descontar stock solo de los ítems que son productos.
      for (const l of lineas) {
        if (l.productoId !== null) {
          await tx.producto.update({
            where: { id: l.productoId },
            data: { stockActual: { decrement: l.cantidad } },
          });
        }
      }

      // Registrar el movimiento de caja. Si es fiado, lo ligamos al cliente.
      await tx.movimientoCaja.create({
        data: {
          empresaId,
          tipo: "venta",
          monto: total,
          descripcion: `Venta #${venta.id} (${medioPago})`,
          clienteId: cliente ? cliente.id : null,
        },
      });

      // Si es fiado, sumar la deuda al saldo del cliente.
      if (medioPago === "fiado" && cliente) {
        await tx.cliente.update({
          where: { id: cliente.id },
          data: { saldo: { increment: total } },
        });
      }

      return venta.id;
    });

    res.status(201).json({ ok: true, ventaId, total });
  } catch (err) {
    res.status(500).json({ error: "No se pudo registrar la venta.", detalle: String(err) });
  }
});

// POST /api/ventas/:id/anular — anula una venta (no la borra).
//
// Deshace TODO lo que la venta hizo, de forma atómica:
//   1) devuelve el stock de cada producto,
//   2) si fue fiado, le baja la deuda al cliente,
//   3) la marca como anulada (con fecha y motivo) → deja de contar en
//      caja/resumen/historial, pero queda el registro.
//
// La plata "sale de la caja" sola: como las consultas de caja y resumen
// excluyen las ventas anuladas, el efectivo esperado baja al anular.
// Body: { motivo? }
ventasRouter.post("/ventas/:id/anular", async (req, res) => {
  const empresaId = req.empresaId;
  const id = Number(req.params.id);
  const motivo = String(req.body?.motivo ?? "").trim() || null;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Venta inválida." });
  }

  // Cargar la venta (de esta empresa) con sus ítems.
  const venta = await prisma.venta.findFirst({
    where: { id, empresaId },
    include: { items: true },
  });
  if (!venta) return res.status(404).json({ error: "La venta no existe." });
  if (venta.anuladaEn !== null) {
    return res.status(409).json({ error: "La venta ya estaba anulada." });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Devolver stock de los ítems que son productos.
      for (const it of venta.items) {
        if (it.productoId !== null) {
          await tx.producto.update({
            where: { id: it.productoId },
            data: { stockActual: { increment: it.cantidad } },
          });
        }
      }

      // 2) Si fue fiado, sacarle la deuda al cliente.
      if (venta.medioPago === "fiado" && venta.clienteId) {
        await tx.cliente.update({
          where: { id: venta.clienteId },
          data: { saldo: { decrement: venta.total } },
        });
      }

      // 3) Marcar la venta como anulada (queda el registro, no se borra).
      await tx.venta.update({
        where: { id: venta.id },
        data: { anuladaEn: new Date(), motivoAnulacion: motivo },
      });

      // Dejar rastro en caja (tipo "anulacion" NO se suma en ningún cálculo,
      // es solo para auditoría / que quede asentado el movimiento).
      await tx.movimientoCaja.create({
        data: {
          empresaId,
          tipo: "anulacion",
          monto: venta.total,
          descripcion: `Anulación venta #${venta.id}${motivo ? ` — ${motivo}` : ""}`,
          clienteId: venta.clienteId,
        },
      });
    });

    res.json({ ok: true, ventaId: venta.id });
  } catch (err) {
    res.status(500).json({ error: "No se pudo anular la venta.", detalle: String(err) });
  }
});
