import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// A database shared with other apps keeps this one's tables in a schema of their
// own, named by `?schema=` at the end of the address. Without it they are in "public".
const address = process.env.DATABASE_URL ?? '';
const schema = URL.canParse(address) ? new URL(address).searchParams.get('schema') : null;

// One shared client. On Vercel the app is loaded per serverless instance, so
// its connections are reused between requests there too.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: address }, schema ? { schema } : undefined),
  // Password hashes and image bytes are left out of normal queries; the few
  // places that need them ask with `omit: { <field>: false }` or `select`
  omit: {
    user: { passwordHash: true },
    photo: { data: true },
    sale: { paymentProof: true },
  },
});

export default prisma;

// Opened on first use. Rejects when the database cannot be reached.
let connecting = null;

export function connectDb() {
  if (!connecting) {
    connecting = (
      process.env.DATABASE_URL
        ? prisma.$queryRaw`SELECT 1`
        : Promise.reject(new Error('DATABASE_URL is not set'))
    ).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

export const disconnectDb = () => prisma.$disconnect();
