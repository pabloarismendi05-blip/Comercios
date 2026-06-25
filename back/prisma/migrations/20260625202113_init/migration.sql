-- CreateTable
CREATE TABLE "empresas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "productos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo_barras" TEXT,
    "precio_venta" DECIMAL NOT NULL,
    "precio_costo" DECIMAL NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "productos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "saldo" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ventas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER NOT NULL,
    "fecha_hora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total" DECIMAL NOT NULL,
    "medio_pago" TEXT NOT NULL,
    "cliente_id" INTEGER,
    CONSTRAINT "ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL NOT NULL,
    CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER NOT NULL,
    "fecha_hora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    CONSTRAINT "movimientos_caja_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "productos_empresa_id_idx" ON "productos"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_empresa_id_codigo_barras_key" ON "productos"("empresa_id", "codigo_barras");

-- CreateIndex
CREATE INDEX "clientes_empresa_id_idx" ON "clientes"("empresa_id");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_idx" ON "ventas"("empresa_id");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_fecha_hora_idx" ON "ventas"("empresa_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "venta_items_venta_id_idx" ON "venta_items"("venta_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_empresa_id_idx" ON "movimientos_caja"("empresa_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_empresa_id_fecha_hora_idx" ON "movimientos_caja"("empresa_id", "fecha_hora");
