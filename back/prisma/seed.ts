import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Datos mínimos para poder probar: la empresa 1 (testing), unos productos y
// un cliente con fiado. Es idempotente: si ya existe la empresa 1, no duplica.
async function main() {
  const empresa = await prisma.empresa.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nombre: "Kiosco de Prueba" },
  });

  const cantProductos = await prisma.producto.count({
    where: { empresaId: empresa.id },
  });

  if (cantProductos === 0) {
    await prisma.producto.createMany({
      data: [
        { empresaId: empresa.id, nombre: "Coca Cola 500ml", codigoBarras: "7790895000010", precioVenta: 1200, precioCosto: 800, stockActual: 24, stockMinimo: 6 },
        { empresaId: empresa.id, nombre: "Alfajor Jorgito", codigoBarras: "7790040000020", precioVenta: 700, precioCosto: 450, stockActual: 40, stockMinimo: 10 },
        { empresaId: empresa.id, nombre: "Cigarrillos Marlboro Box", codigoBarras: "7790010000030", precioVenta: 3500, precioCosto: 2900, stockActual: 5, stockMinimo: 8 },
        { empresaId: empresa.id, nombre: "Agua Villavicencio 1.5L", codigoBarras: null, precioVenta: 1500, precioCosto: 1000, stockActual: 12, stockMinimo: 4 },
        { empresaId: empresa.id, nombre: "Chicle Beldent", codigoBarras: "7790040000050", precioVenta: 500, precioCosto: 300, stockActual: 2, stockMinimo: 10 },
      ],
    });
  }

  const cantClientes = await prisma.cliente.count({
    where: { empresaId: empresa.id },
  });

  if (cantClientes === 0) {
    await prisma.cliente.create({
      data: { empresaId: empresa.id, nombre: "Vecino del 3ºB", saldo: 0 },
    });
  }

  console.log("✅ Seed listo: empresa 'Kiosco de Prueba' con productos y cliente.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
