import Option from './models/Option.js';
import { badRequest } from './evidence.js';

// What a new database starts with
const DEFAULTS = {
  farm: ['HQ', 'Baktaherhali'],
  coop: Array.from({ length: 9 }, (_, i) => `Coop ${i + 1}`),
};

const LABELS = { farm: 'Farm', coop: 'Coop' };

const keyOf = (name) => name.toLowerCase();

async function namesOf(kind) {
  const find = () => Option.find({ kind }).sort({ _id: 1 });
  let options = await find();

  if (options.length === 0) {
    try {
      await Option.insertMany(
        DEFAULTS[kind].map((name) => ({ kind, name, key: keyOf(name) })),
        { ordered: false }
      );
    } catch (err) {
      // Another request seeded the same defaults at the same moment
      if (err.code !== 11000 && !err.writeErrors) throw err;
    }
    options = await find();
  }

  return options.map((option) => option.name);
}

export const listOptions = async () => ({
  farms: await namesOf('farm'),
  coops: await namesOf('coop'),
});

export async function addOption(kind, rawName, addedBy) {
  const name = String(rawName ?? '').trim();
  if (!name) throw badRequest(`${LABELS[kind]} name is required`);
  if (name.length > 40) throw badRequest(`${LABELS[kind]} name is too long`);

  const existing = await namesOf(kind);
  if (existing.some((other) => keyOf(other) === keyOf(name))) {
    throw badRequest(`${LABELS[kind]} "${name}" already exists`);
  }

  await Option.create({ kind, name, key: keyOf(name), addedBy });
  return listOptions();
}

// The listed spelling of a coop name, or null when it is not one of the coops
export async function listedCoop(rawName) {
  const name = String(rawName ?? '').trim();
  const coops = await namesOf('coop');
  return coops.find((coop) => keyOf(coop) === keyOf(name)) ?? null;
}
