import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import { mortalityRouter, vaccinationRouter } from './routes/records.js';

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/flock-management';

const app = express();
app.use(cors());
// Records carry a camera photo as a base64 data URL
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
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

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add a long random value to server/.env');
  process.exit(1);
}

try {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
} catch (err) {
  console.error(`Could not connect to MongoDB (check MONGO_URI in server/.env): ${err.message}`);
  process.exit(1);
}
