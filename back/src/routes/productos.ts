import { Router } from "express";
import { prisma } from "../prisma.js";

export const productosRouter = Router();

// Forma común de devolver un producto (precios como número, no Decimal).
function aPlano(p: {
  id: number;
  nombre: string;
  codigoBarras: string | null;
  precioVenta: unknown;
  precioCosto: unknown;
  stockActual: number;
  stockMinimo: number;
}) {
  return {
    id: p.id,
    nombre: p.nombre,
    codigoBarras: p.codigoBarras,
    precioVenta: Number(p.precioVenta),
    precioCosto: Number(p.precioCosto),
    stockActual: p.stockActual,
    stockMinimo: p.stockMinimo,
  };
}

// Validación compartida para crear/editar.
function validarDatos(body: any): { ok: true; datos: any } | { ok: false; error: string } {
  const nombre = String(body?.nombre ?? "").trim();
  const precioVenta = Number(body?.precioVenta);
  const precioCosto = Number(body?.precioCosto);
  const stockActual = Number(body?.stockActual);
  const stockMinimo = Number(body?.stockMinimo);
  const codigoBarras = body?.codigoBarras ? String(body.codigoBarras).trim() : null;

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (!Number.isFinite(precioVenta) || precioVenta < 0)
    return { ok: false, error: "El precio de venta no es válido." };
  if (!Number.isFinite(precioCosto) || precioCosto < 0)
    return { ok: false, error: "El precio de costo no es válido." };
  if (!Number.isInteger(stockActual) || stockActual < 0)
    return { ok: false, error: "El stock no es válido." };
  if (!Number.isInteger(stockMinimo) || stockMinimo < 0)
    return { ok: false, error: "El stock mínimo no es válido." };

  return {
    ok: true,
    datos: { nombre, precioVenta, precioCosto, stockActual, stockMinimo, codigoBarras },
  };
}

// Listar / buscar productos. ?q= filtra por nombre o código.
// ?soloReponer=1 devuelve solo los que están en o bajo el stock mínimo.
productosRouter.get("/productos", async (req, res) => {
  const empresaId = req.empresaId;
  const q = String(req.query.q ?? "").trim();
  const soloReponer = req.query.soloReponer === "1";

  const where: any = { empresaId };
  if (q) {
    where.OR = [{ nombre: { contains: q } }, { codigoBarras: { contains: q } }];
  }

  let productos = await prisma.producto.findMany({
    where,
    take: 200,
    orderBy: { nombre: "asc" },
  });

  // El "hay que reponer" (stockActual <= stockMinimo) se filtra en memoria
  // porque SQLite no compara dos columnas dentro del where de Prisma.
  if (soloReponer) {
    productos = productos.filter((p) => p.stockActual <= p.stockMinimo);
  }

  res.json(productos.map(aPlano));
});

// Crear producto.
productosRouter.post("/productos", async (req, res) => {
  const empresaId = req.empresaId;
  const v = validarDatos(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  try {
    const p = await prisma.producto.create({ data: { empresaId, ...v.datos } });
    res.status(201).json(aPlano(p));
  } catch (err) {
    res.status(409).json({ error: "Ya existe un producto con ese código de barras." });
  }
});

// Editar producto. (Cambiar el precio NO afecta ventas ya hechas: cada
// VentaItem guardó el precio del momento.)
productosRouter.put("/productos/:id", async (req, res) => {
  const empresaId = req.empresaId;
  const id = Number(req.params.id);
  const v = validarDatos(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const existe = await prisma.producto.findFirst({ where: { id, empresaId } });
  if (!existe) return res.status(404).json({ error: "El producto no existe." });

  try {
    const p = await prisma.producto.update({ where: { id }, data: v.datos });
    res.json(aPlano(p));
  } catch (err) {
    res.status(409).json({ error: "Ya existe un producto con ese código de barras." });
  }
});
