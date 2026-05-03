import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './config/db.js';

import authRoutes          from './routes/auth.js';
import requisicionesRoutes from './routes/requisiciones.js';
import adminRoutes         from './routes/admin.js';
import escanearRoutes      from './routes/escanear.js';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT) || 4000;

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
    ].filter((u): u is string => Boolean(u));

    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS bloqueado: ' + origin));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',          authRoutes);
app.use('/api/requisiciones', requisicionesRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/escanear',      escanearRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'conectada', hora: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: 'sin conexión' });
  }
});

app.use((_req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada.' }));

app.listen(PORT, () => {
  console.log(`\n🏛️  Acateno API corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});