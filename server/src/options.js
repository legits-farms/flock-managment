import Option from './models/Option.js';
import { badRequest } from './evidence.js';

// What a new database starts with
const DEFAULT_FARMS = ['HQ', 'Baktaherhali'];
// How many coops ("Coop 1" … "Coop N") each default farm starts with
const DEFAULT_COOPS = { hq: 4, baktaherhali: 9 };
// Coops listed before coops belonged to a farm were Baktaherhali's nine
const LEGACY_COOP_FARM = 'Baktaherhali';

const keyOf = (name) => name.trim().toLowerCase();

// The same coop name can exist on several farms, so a coop's key carries its farm
const coopKey = (farm, name) => `${keyOf(farm)}|${keyOf(name)}`;

// Inserts defaults, tolerating another request seeding the same ones at the same moment
async function seed(options) {
  try {
    await Option.insertMany(options, { ordered: false });
  } catch (err) {
    if (err.code !== 11000 && !err.writeErrors) throw err;
  }
}

async function farmNames() {
  const find = () => Option.find({ kind: 'farm' }).sort({ _id: 1 });
  let farms = await find();
  if (farms.length === 0) {
    await seed(DEFAULT_FARMS.map((name) => ({ kind: 'farm', name, key: keyOf(name) })));
    farms = await find();
  }
  return farms.map((farm) => farm.name);
}

async function moveLegacyCoops() {
  const legacy = await Option.find({ kind: 'coop', farm: { $in: [null, ''] } });
  for (const coop of legacy) {
    coop.farm = LEGACY_COOP_FARM;
    coop.key = coopKey(LEGACY_COOP_FARM, coop.name);
    try {
      await coop.save();
    } catch (err) {
      if (err.code !== 11000) throw err;
      // Already moved by another request
      await coop.deleteOne();
    }
  }
}

// { farms: [names], coops: { <farm name>: [coop names] } }
export async function listOptions() {
  const farms = await farmNames();
  await moveLegacyCoops();

  const find = () => Option.find({ kind: 'coop' }).sort({ _id: 1 });
  let coops = await find();

  const missing = farms.filter(
    (farm) => DEFAULT_COOPS[keyOf(farm)] && !coops.some((coop) => keyOf(coop.farm) === keyOf(farm))
  );
  if (missing.length > 0) {
    await seed(
      missing.flatMap((farm) =>
        Array.from({ length: DEFAULT_COOPS[keyOf(farm)] }, (_, i) => {
          const name = `Coop ${i + 1}`;
          return { kind: 'coop', farm, name, key: coopKey(farm, name) };
        })
      )
    );
    coops = await find();
  }

  return {
    farms,
    coops: Object.fromEntries(
      farms.map((farm) => [
        farm,
        coops.filter((coop) => keyOf(coop.farm) === keyOf(farm)).map((coop) => coop.name),
      ])
    ),
  };
}

function parseName(rawName, label) {
  const name = String(rawName ?? '').trim();
  if (!name) throw badRequest(`${label} name is required`);
  if (name.length > 40) throw badRequest(`${label} name is too long`);
  return name;
}

// Both resolve to the full, updated lists
export async function addFarm(rawName, addedBy) {
  const name = parseName(rawName, 'Farm');
  const { farms } = await listOptions();
  if (farms.some((farm) => keyOf(farm) === keyOf(name))) {
    throw badRequest(`Farm "${name}" already exists`);
  }

  await Option.create({ kind: 'farm', name, key: keyOf(name), addedBy });
  return listOptions();
}

export async function addCoop(rawFarm, rawName, addedBy) {
  const farm = await listedFarm(rawFarm);
  if (!farm) throw badRequest('Select the farm this coop is on');
  const name = parseName(rawName, 'Coop');
  if (await listedCoop(name, farm)) throw badRequest(`Coop "${name}" already exists on ${farm}`);

  await Option.create({ kind: 'coop', farm, name, key: coopKey(farm, name), addedBy });
  return listOptions();
}

// The listed spelling of a farm name, or null when it is not on the list
export async function listedFarm(rawName) {
  const name = String(rawName ?? '');
  const { farms } = await listOptions();
  return farms.find((farm) => keyOf(farm) === keyOf(name)) ?? null;
}

// The listed spelling of a coop on the given farm, or null when that farm has no such coop
export async function listedCoop(rawName, rawFarm) {
  const name = String(rawName ?? '');
  const { farms, coops } = await listOptions();
  const farm = farms.find((other) => keyOf(other) === keyOf(String(rawFarm ?? '')));
  if (!farm) return null;
  return coops[farm].find((coop) => keyOf(coop) === keyOf(name)) ?? null;
}
