import prisma from './db.js';
import { badRequest } from './evidence.js';
import { addedBy } from './serialize.js';

// What a new database starts with. These are always listed first, in this
// order, ahead of any farms added later.
const DEFAULT_FARMS = ['Bhaktharahali', 'HQ'];
// The coops each default farm starts with. A coop is split into parts only
// when it is needed, by adding them: "Coop 1A", "Coop 1B", …
export const DEFAULT_COOPS = {
  hq: ['Coop 1', 'Coop 2', 'Coop 3', 'Coop 4'],
  bhaktharahali: ['Brooding A', 'Brooding B', ...[1, 2, 3, 4, 5, 6, 7].map((n) => `Coop ${n}`)],
};

const keyOf = (name) => name.trim().toLowerCase();

// A part of a coop is the coop's name followed by a letter or a name: "Coop 5C"
// is part C of "Coop 5", "Coop 4 Sonali" its part Sonali. A brooding house ends
// in a letter, so its parts are numbered: "Brooding A2" is part 2 of "Brooding A",
// "Brooding A Sonali" its part Sonali. { coop, label }, or null for any other name.
export function partOf(name) {
  const text = name.trim();
  const match =
    /^(brooding\s+[a-z])(?:(\d+)|\s+([a-z].*))$/i.exec(text) ?? /^(.*\d)\s*([a-z].*)$/i.exec(text);
  return match ? { coop: match[1], label: match[2] ?? match[3] } : null;
}

// Coop 1 can be split into 8 parts, any other coop into 6
export const maxParts = (coop) => (keyOf(coop) === 'coop 1' ? 8 : 6);

// The name of the next part of a coop on the farm, or of the coop a part
// belongs to: "Coop 3B" when "Coop 3A" exists, "Brooding A2" when "Brooding A1"
// does. Refuses a coop that cannot take another part.
export async function nextPartName(name, farm) {
  const { coops } = await listOptions();
  const listed = Object.entries(coops).find(([other]) => keyOf(other) === keyOf(farm))?.[1] ?? [];
  const parent = partOf(name);
  const coop = (parent && listed.find((other) => keyOf(other) === keyOf(parent.coop))) || name;
  // Only a brooding house or a numbered coop is split into parts
  const brooding = /^brooding\s+[a-z]$/i.test(coop.trim());
  if (!brooding && !/\d$/.test(coop.trim())) throw badRequest(`${coop} cannot be split into parts`);
  const taken = listed
    .filter((other) => keyOf(partOf(other)?.coop ?? '') === keyOf(coop))
    .map((other) => partOf(other).label.toUpperCase());
  if (taken.length >= maxParts(coop)) {
    throw badRequest(`${coop} can have only ${maxParts(coop)} parts`);
  }
  const label = [...(brooding ? '12345678' : 'ABCDEFGH')].find((one) => !taken.includes(one));
  return `${coop}${label}`;
}

// A farm's coop names in the order they were added, except that a coop's parts
// come right after it, however much later they were added
function partsAfterCoop(names) {
  const coopOf = (name) => {
    const part = partOf(name);
    return part && names.some((other) => keyOf(other) === keyOf(part.coop)) ? part.coop : null;
  };
  return names
    .filter((name) => !coopOf(name))
    .flatMap((coop) => [coop, ...names.filter((name) => keyOf(coopOf(name) ?? '') === keyOf(coop))]);
}

// The same coop name can exist on several farms, so a coop's key carries its farm
const coopKey = (farm, name) => `${keyOf(farm)}|${keyOf(name)}`;

// Options of one kind, in the order they were added
const optionsOf = (kind) => prisma.option.findMany({ where: { kind }, orderBy: { seq: 'asc' } });

// Inserts defaults, tolerating another request seeding the same ones at the same moment
const seed = (options) => prisma.option.createMany({ data: options, skipDuplicates: true });

async function farmNames() {
  let farms = await optionsOf('farm');
  if (farms.length === 0) {
    await seed(DEFAULT_FARMS.map((name) => ({ kind: 'farm', name, key: keyOf(name) })));
    farms = await optionsOf('farm');
  }
  // The default farms first, then the rest in the order they were added
  const rank = (name) => {
    const index = DEFAULT_FARMS.findIndex((farm) => keyOf(farm) === keyOf(name));
    return index === -1 ? DEFAULT_FARMS.length : index;
  };
  return farms.map((farm) => farm.name).sort((a, b) => rank(a) - rank(b));
}

// { farms: [names], coops: { <farm name>: [coop names] }, vaccines: [{ vaccine, when }],
// feedTypes: [names] }. The vaccines and feed types are only those added by hand; the
// standard ones are in the app itself.
export async function listOptions() {
  const farms = await farmNames();
  let coops = await optionsOf('coop');

  const missing = farms.filter(
    (farm) => DEFAULT_COOPS[keyOf(farm)] && !coops.some((coop) => keyOf(coop.farm) === keyOf(farm))
  );
  if (missing.length > 0) {
    await seed(
      missing.flatMap((farm) =>
        DEFAULT_COOPS[keyOf(farm)].map((name) => ({
          kind: 'coop',
          farm,
          name,
          key: coopKey(farm, name),
        }))
      )
    );
    coops = await optionsOf('coop');
  }

  const vaccines = await optionsOf('vaccine');
  const feedTypes = await optionsOf('feedType');

  return {
    farms,
    vaccines: vaccines.map((option) => ({ vaccine: option.name, when: option.schedule ?? '' })),
    feedTypes: feedTypes.map((option) => option.name),
    coops: Object.fromEntries(
      farms.map((farm) => [
        farm,
        partsAfterCoop(
          coops.filter((coop) => keyOf(coop.farm) === keyOf(farm)).map((coop) => coop.name)
        ),
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

const exists = (kind, key) => prisma.option.findUnique({ where: { kind_key: { kind, key } } });

export async function addFeedType(rawName, who) {
  const name = parseName(rawName, 'Feed type');
  if (await exists('feedType', keyOf(name))) {
    throw badRequest(`Feed type "${name}" is already on the list`);
  }

  await prisma.option.create({
    data: { kind: 'feedType', name, key: keyOf(name), ...addedBy(who) },
  });
  return listOptions();
}

// `rawSchedule` is the age the vaccine is given at and may be left empty
export async function addVaccine(rawName, rawSchedule, who) {
  const name = parseName(rawName, 'Vaccine');
  const schedule = String(rawSchedule ?? '').trim();
  if (schedule.length > 40) throw badRequest('Day / week is too long');

  const key = `${keyOf(name)}|${keyOf(schedule)}`;
  if (await exists('vaccine', key)) {
    throw badRequest(`Vaccine "${name}" is already on the list`);
  }

  await prisma.option.create({ data: { kind: 'vaccine', name, schedule, key, ...addedBy(who) } });
  return listOptions();
}

// Both resolve to the full, updated lists
export async function addFarm(rawName, who) {
  const name = parseName(rawName, 'Farm');
  const { farms } = await listOptions();
  if (farms.some((farm) => keyOf(farm) === keyOf(name))) {
    throw badRequest(`Farm "${name}" already exists`);
  }

  await prisma.option.create({ data: { kind: 'farm', name, key: keyOf(name), ...addedBy(who) } });
  return listOptions();
}

export async function addCoop(rawFarm, rawName, who) {
  const farm = await listedFarm(rawFarm);
  if (!farm) throw badRequest('Select the farm this coop is on');
  const name = parseName(rawName, 'Coop');
  if (await listedCoop(name, farm)) throw badRequest(`Coop "${name}" already exists on ${farm}`);
  // A part of a listed coop stays within that coop's number of parts
  const part = partOf(name);
  const coop = part && (await listedCoop(part.coop, farm));
  if (coop) {
    const { coops } = await listOptions();
    const parts = coops[farm].filter((other) => keyOf(partOf(other)?.coop ?? '') === keyOf(coop));
    if (parts.length >= maxParts(coop)) {
      throw badRequest(`${coop} can have only ${maxParts(coop)} parts`);
    }
  }

  await prisma.option.create({
    data: { kind: 'coop', farm, name, key: coopKey(farm, name), ...addedBy(who) },
  });
  return listOptions();
}

// Takes every coop off a farm's list; listing the options afterwards puts back
// the defaults of a default farm. Resolves to how many were removed.
export async function removeCoops(farm) {
  const { count } = await prisma.option.deleteMany({
    where: { kind: 'coop', farm: { equals: farm.trim(), mode: 'insensitive' } },
  });
  return count;
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

// A coop split into parts takes birds part by part, not as a whole
export async function checkWholeCoop(coop, farm) {
  const { coops } = await listOptions();
  const listed = Object.entries(coops).find(([name]) => keyOf(name) === keyOf(farm))?.[1] ?? [];
  if (listed.some((name) => keyOf(partOf(name)?.coop ?? '') === keyOf(coop))) {
    throw badRequest(`${coop} is split into parts. Select one of its parts`);
  }
}
