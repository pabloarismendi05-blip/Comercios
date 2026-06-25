import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`🛒 Kiosco API escuchando en http://localhost:${PORT}`);
  console.log(`   Probá: http://localhost:${PORT}/api/health`);
});
