-- DropIndex
DROP INDEX "cierres_caja_empresa_id_fecha_key";

-- CreateIndex
CREATE INDEX "cierres_caja_empresa_id_created_at_idx" ON "cierres_caja"("empresa_id", "created_at");
