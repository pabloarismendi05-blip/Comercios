import { PrismaClient } from "@prisma/client";

// Cliente Prisma único para toda la app (evita abrir muchas conexiones).
export const prisma = new PrismaClient();
