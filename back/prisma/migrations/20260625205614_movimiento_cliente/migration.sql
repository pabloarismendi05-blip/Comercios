-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_movimientos_caja" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresa_id" INTEGER NOT NULL,
    "fecha_hora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cliente_id" INTEGER,
    CONSTRAINT "movimientos_caja_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "movimientos_caja_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_movimientos_caja" ("descripcion", "empresa_id", "fecha_hora", "id", "monto", "tipo") SELECT "descripcion", "empresa_id", "fecha_hora", "id", "monto", "tipo" FROM "movimientos_caja";
DROP TABLE "movimientos_caja";
ALTER TABLE "new_movimientos_caja" RENAME TO "movimientos_caja";
CREATE INDEX "movimientos_caja_empresa_id_idx" ON "movimientos_caja"("empresa_id");
CREATE INDEX "movimientos_caja_empresa_id_fecha_hora_idx" ON "movimientos_caja"("empresa_id", "fecha_hora");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
