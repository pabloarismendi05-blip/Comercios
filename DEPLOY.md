# Guía para publicar el Kiosco en internet

Esta guía te lleva de "funciona en mi compu" a "tengo una URL que abro en el
celular". Está pensada para la **primera vez** que publicás algo.

> 🧭 **Cómo leerla:** los pasos marcados con **👉 VOS** los hacés vos (crear
> cuentas, apretar botones). Los marcados con **🤖 CLAUDE** los hago yo desde acá
> cuando me pases lo que haga falta.

## Qué vamos a usar y cuánto cuesta

| Parte | Servicio | Costo |
|------|----------|-------|
| Código | GitHub | Gratis |
| Base de datos (Postgres) | Neon | Gratis (no vence, no pide tarjeta) |
| Backend (la API) | Render | Gratis (se "duerme" tras 15 min sin uso) · US$7/mes opcional para que no se duerma |
| Front (la app) | Render Static Site | Gratis |

**Arrancás gastando $0.** Lo único con costo es opcional y para más adelante.

> ⚠️ El plan gratis de Render **duerme** el backend tras 15 min sin uso. La
> primera visita después de eso tarda ~40 segundos en responder. Es normal. Si
> te molesta, más adelante se pasa a US$7/mes y queda siempre despierto.

---

## PASO 1 — Subir el código a GitHub

**👉 VOS:**
1. Si no tenés cuenta, creá una en https://github.com (gratis).
2. Arriba a la derecha: **+ → New repository**.
   - Name: `kiosco`
   - Dejalo **Private** (privado) si no querés que otros lo vean.
   - **NO** marques "Add a README" (ya tenemos uno).
   - **Create repository**.
3. GitHub te va a mostrar una página con comandos. Copiá la URL del repo, se ve
   así: `https://github.com/TU-USUARIO/kiosco.git`
4. Pegámela acá en el chat.

**🤖 CLAUDE:** con esa URL conecto tu repo y te dejo el código subido (o te paso
los 2 comandos exactos para que lo subas vos, si preferís hacerlo con tu usuario).

---

## PASO 2 — Crear la base de datos (Neon)

**👉 VOS:**
1. Entrá a https://neon.tech y registrate (podés entrar con tu cuenta de GitHub).
2. **Create project** → nombre `kiosco`. Región: la más cercana (ej: AWS São
   Paulo o US East). **Create**.
3. Te va a mostrar una **Connection string** (empieza con `postgresql://...`).
   Copiala entera.
4. Pegámela acá en el chat.

**🤖 CLAUDE:** con esa URL hago el cambio de SQLite a Postgres, genero las
migraciones de Postgres y dejo la base lista. (Tu base local sigue intacta.)

---

## PASO 3 — Publicar el backend (Render)

**👉 VOS:**
1. Entrá a https://render.com y registrate con GitHub.
2. **New + → Web Service** → conectá tu repo `kiosco`.
3. Configurá:
   - **Name:** `kiosco-back`
   - **Root Directory:** `back`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. En **Environment** agregá estas variables (botón "Add Environment Variable"):
   - `DATABASE_URL` = la connection string de Neon (la del Paso 2)
   - `FRONT_URL` = (la dejás vacía por ahora; la completás en el Paso 5)
5. **Create Web Service**. Render va a compilar y publicar (tarda unos minutos).
6. Cuando termine, arriba vas a ver la URL del backend, tipo
   `https://kiosco-back.onrender.com`. Probá entrar a
   `https://kiosco-back.onrender.com/api/health` → tiene que decir
   `{"ok":true,"db":"ok"}`.
7. Pegame esa URL acá.

> Al arrancar, el backend aplica solo las migraciones a la base de Neon
> (no tenés que hacer nada manual con la base).

---

## PASO 4 — Publicar el front (Render Static Site)

**🤖 CLAUDE:** primero pongo la URL de tu backend (Paso 3) en la config del
front y subo el cambio.

**👉 VOS:**
1. En Render: **New + → Static Site** → mismo repo `kiosco`.
2. Configurá:
   - **Name:** `kiosco`
   - **Root Directory:** `front`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist/front/browser`
3. **Create Static Site**. Cuando termine te da una URL tipo
   `https://kiosco.onrender.com`.
4. **Importante (para que la app no dé error al recargar):** entrá a la pestaña
   **Redirects/Rewrites** del static site y agregá una regla:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: **Rewrite**
5. Pegame la URL del front.

---

## PASO 5 — Conectar las dos puntas

**👉 VOS:** en Render → `kiosco-back` → **Environment** → editá `FRONT_URL` y
poné la URL del front (Paso 4, ej: `https://kiosco.onrender.com`). Guardá: el
backend se reinicia solo.

Esto hace que el backend solo acepte pedidos de tu app (seguridad básica, CORS).

---

## PASO 6 — Probar en el celular

Abrí en el celular la URL del front (Paso 4). Deberías poder ver el resumen,
vender, etc. 🎉 (Si el backend estaba dormido, la primera carga tarda ~40s.)

---

## El "auto-deploy" (ya queda andando)

Tanto el backend como el front quedan conectados a tu repo de GitHub. Cada vez
que subamos un cambio a la rama `main`, Render lo vuelve a publicar **solo**. No
tenés que volver a hacer nada de esto.

## Tu compu sigue funcionando igual

Nada de esto rompe tu desarrollo local. Para seguir trabajando en tu compu:

```bash
# backend
cd back
npm run dev
# front
cd front
ng serve --host 127.0.0.1
```

> Después de pasar a Postgres (Paso 2), tu `.env` local va a apuntar a una base
> de Postgres (te dejo una gratis aparte para desarrollo, así no tocás los datos
> reales de producción). Te explico eso cuando lleguemos a ese paso.
