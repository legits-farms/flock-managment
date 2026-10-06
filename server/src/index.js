// Local / long-running server. On Vercel the app is served by api/index.mjs instead.
import app, { connectDb } from './app.js';

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add a long random value to server/.env');
  process.exit(1);
}

try {
  await connectDb();
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
} catch (err) {
  console.error(`Could not connect to MongoDB (check MONGO_URI in server/.env): ${err.message}`);
  process.exit(1);
}
