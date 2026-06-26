-- CreateTable
CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,
    "efectivo_esperado" DECIMAL(65,30) NOT NULL,
    "efectivo_contado" DECIMAL(65,30) NOT NULL,
    "diferencia" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cierres_caja_empresa_id_idx" ON "cierres_caja"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_caja_empresa_id_fecha_key" ON "cierres_caja"("empresa_id", "fecha");

-- AddForeignKey
ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
