-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_venta_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER,
    "descripcion" TEXT,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL NOT NULL,
    CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_venta_items" ("cantidad", "id", "precio_unitario", "producto_id", "venta_id") SELECT "cantidad", "id", "precio_unitario", "producto_id", "venta_id" FROM "venta_items";
DROP TABLE "venta_items";
ALTER TABLE "new_venta_items" RENAME TO "venta_items";
CREATE INDEX "venta_items_venta_id_idx" ON "venta_items"("venta_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
