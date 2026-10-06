import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import { mortalityRouter, vaccinationRouter } from './routes/records.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flock-management';

// One shared connection, opened on first use. On Vercel the app is loaded per
// serverless instance, so the connection is reused between requests there too.
let connecting = null;

export function connectDb() {
  if (!connecting) {
    // A mongodb+srv:// address needs a DNS lookup that some PCs' default DNS refuses.
    // DNS_SERVERS (comma separated) makes Node use those servers instead.
    if (process.env.DNS_SERVERS) {
      dns.setServers(process.env.DNS_SERVERS.split(',').map((server) => server.trim()));
    }
    connecting = mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 }).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

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
    console.error(`Could not connect to MongoDB: ${err.message}`);
    res.status(503).json({ message: 'The database is unavailable. Please try again.' });
  }
});

app.use('/api/auth', authRoutes);
// Everything below needs a logged-in user
app.use('/api/batches', requireAuth, batchRoutes);
app.use('/api/mortalities', requireAuth, mortalityRouter);
app.use('/api/vaccinations', requireAuth, vaccinationRouter);

app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => (e.name === 'CastError' ? `${e.path} is not valid` : e.message))
      .join('. ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') {
    return res.status(404).json({ message: 'Not found' });
  }
  if (err.status === 400) {
    return res.status(400).json({ message: err.message });
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
