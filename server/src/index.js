// Local / long-running server. On Vercel the "server" service loads app.js directly
// (see vercel.json).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app, { connectDb } from './app.js';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add a long random value to server/.env');
  process.exit(1);
}

// On a host that runs just this one server (e.g. Render), it serves the built app
// too. In development the Vite dev server does that and there is no build to serve.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  // Every other address opens the app; an unknown /api path stays a 404
  app.get(/^\/(?!api\/)/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

try {
  await connectDb();
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
} catch (err) {
  console.error(`Could not connect to MongoDB (check MONGO_URI in server/.env): ${err.message}`);
  process.exit(1);
}
