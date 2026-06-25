import { Router } from "express";
import { prisma } from "../prisma.js";
import { claveFecha } from "../fecha.js";

export const resumenRouter = Router();

// GET /api/resumen — números para la pantalla de inicio.
// "Hoy" = desde las 00:00 de hoy (hora local del server).
// "Semana" = últimos 7 días (hoy incluido).
resumenRouter.get("/resumen", async (req, res) => {
  const empresaId = req.empresaId;

  const ahora = new Date();
  const inicioHoy = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate(),
    0, 0, 0, 0
  );
  const inicioSemana = new Date(inicioHoy);
  inicioSemana.setDate(inicioSemana.getDate() - 6);

  const [hoyAgg, semanaAgg, porMedioRaw, ventasSemana] = await Promise.all([
    prisma.venta.aggregate({
      where: { empresaId, fechaHora: { gte: inicioHoy } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.aggregate({
      where: { empresaId, fechaHora: { gte: inicioSemana } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.groupBy({
      by: ["medioPago"],
      where: { empresaId, fechaHora: { gte: inicioHoy } },
      _sum: { total: true },
    }),
    prisma.venta.findMany({
      where: { empresaId, fechaHora: { gte: inicioSemana } },
      select: { fechaHora: true, total: true },
    }),
  ]);

  // Día por día de los últimos 7 días (del más viejo a hoy).
  const porDia: { fecha: string; etiqueta: string; total: number; esHoy: boolean }[] = [];
  const indicePorFecha = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    const clave = claveFecha(d);
    indicePorFecha.set(clave, i);
    porDia.push({
      fecha: clave,
      etiqueta: d.toLocaleDateString("es-AR", { weekday: "short" }),
      total: 0,
      esHoy: clave === claveFecha(inicioHoy),
    });
  }
  for (const v of ventasSemana) {
    const i = indicePorFecha.get(claveFecha(v.fechaHora));
    if (i !== undefined) porDia[i].total += Number(v.total);
  }

  // Desglose de hoy por medio de pago (siempre con las 3 claves, aunque sea 0).
  const porMedio = { efectivo: 0, transferencia: 0, fiado: 0 } as Record<
    string,
    number
  >;
  for (const fila of porMedioRaw) {
    porMedio[fila.medioPago] = Number(fila._sum.total ?? 0);
  }

  res.json({
    hoy: {
      total: Number(hoyAgg._sum.total ?? 0),
      cantidad: hoyAgg._count,
      porMedio,
    },
    semana: {
      total: Number(semanaAgg._sum.total ?? 0),
      cantidad: semanaAgg._count,
    },
    porDia,
  });
});
