# Kiosco — sistema de gestión para kioscos

Sistema simple para que un kiosquero registre ventas rápido, controle stock y
lleve el fiado. Pensado mobile-first y multi-tenant (cada kiosco ve solo sus
datos).

## Estructura

```
kiosco/
├── back/     API REST — Node + TypeScript + Express + Prisma
└── front/    App — Angular (mobile-first, PWA en etapa futura)
```

## Stack y decisiones

- **Backend**: Node + TypeScript + Express.
- **ORM**: Prisma. En desarrollo usa **SQLite** (un archivo, sin instalar nada).
  Para producción se migra a **PostgreSQL** cambiando solo el `provider` del
  schema y la `DATABASE_URL`.
- **Multi-tenant**: el `empresa_id` lo resuelve siempre el servidor
  (middleware), nunca el cliente.

## Cómo levantar el backend

```bash
cd back
npm install                 # solo la primera vez
npx prisma migrate dev      # crea la base y aplica migraciones (+ seed)
npm run dev                 # levanta la API en http://localhost:3000
```

Probar que anda:

```
GET http://localhost:3000/api/health   ->   {"ok":true,"db":"ok"}
```

Otros comandos útiles:

- `npm run build` — compila TypeScript (chequeo de tipos).
- `npm run prisma:studio` — abre Prisma Studio para ver/editar la base.
- `npm run seed` — vuelve a cargar los datos de prueba.

## Cómo levantar el front

```bash
cd front
npm install
ng serve --host 127.0.0.1
# abrir http://127.0.0.1:4200
```

## Modelo de datos

Empresa (kiosco) → Producto, Cliente, Venta, MovimientoCaja.
Venta → VentaItem (guarda el precio del momento de la venta).
Ver detalle en `back/prisma/schema.prisma`.

## Estado / roadmap

- [x] **Etapa 1** — estructura, base de datos y modelo con migraciones.
- [ ] Etapa 2 — pantalla de venta rápida (POS).
- [ ] Etapa 3 — resumen del día/semana.
- [ ] Etapa 4 — lista de productos con aviso de stock bajo.
- [ ] Etapa 5 — fiado (deuda de clientes y pagos).
