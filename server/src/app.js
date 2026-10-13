import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { requireAuth, staffOnly, staffOrReadOnly } from './auth.js';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import feedPurchaseRoutes from './routes/feedPurchases.js';
import optionRoutes from './routes/options.js';
import {
  feedRouter,
  mortalityRouter,
  vaccinationRouter,
  weightRouter,
} from './routes/records.js';
import saleRoutes from './routes/sales.js';
import shiftRoutes from './routes/shifts.js';
import userRoutes from './routes/users.js';

const app = express();
app.use(cors());
// Records carry a camera photo as a base64 data URL
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', async (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    return res.status(500).json({ message: 'The server is not set up yet (JWT_SECRET missing).' });
  }
  try {
    await connectDb();
    next();
  } catch (err) {
    console.error(`Could not connect to PostgreSQL: ${err.message}`);
    res.status(503).json({ message: 'The database is unavailable. Please try again.' });
  }
});

app.use('/api/auth', authRoutes);
// Everything below needs a logged-in user. A security guard gets mortality, and
// the batches and their coops to register it against, but nothing else.
app.use('/api/mortalities', requireAuth, mortalityRouter);
app.use('/api/batches', requireAuth, staffOrReadOnly, batchRoutes);
app.use('/api/options', requireAuth, staffOnly, optionRoutes);
app.use('/api/vaccinations', requireAuth, staffOnly, vaccinationRouter);
app.use('/api/feeds', requireAuth, staffOnly, feedRouter);
app.use('/api/weights', requireAuth, staffOnly, weightRouter);
app.use('/api/shifts', requireAuth, staffOnly, shiftRoutes);
app.use('/api/sales', requireAuth, staffOnly, saleRoutes);
app.use('/api/feed-purchases', requireAuth, staffOnly, feedPurchaseRoutes);
// Admins only: the router itself turns everyone else away
app.use('/api/users', requireAuth, userRoutes);

app.use((err, req, res, next) => {
  if (err.status === 400) {
    return res.status(400).json({ message: err.message });
  }
  // Prisma: a row that has to be unique already exists, e.g. two people adding the same coop
  if (err.code === 'P2002') {
    return res.status(400).json({ message: 'That already exists' });
  }
  // Prisma: the row to change is not there (any more)
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Not found' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Photo is too large' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

export default app;
