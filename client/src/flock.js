// Bird-count helpers shared by the tabs

export const formatNumber = (value) => Number(value).toLocaleString('en-IN');

// A bird's weight, given in grams: "850 g", or "1.25 kg" from a kilo on
export const formatWeight = (grams) =>
  grams < 1000 ? `${formatNumber(grams)} g` : formatKg(grams / 1000);

export const formatKg = (kg) => `${formatNumber(Number(Number(kg).toFixed(2)))} kg`;

const DAY_MS = 24 * 60 * 60 * 1000;
const calendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

// How old the birds are today, in days: their age when the batch started plus
// the days that have passed since its start date
export function batchAgeDays(batch) {
  const atEntry = batch.age * (batch.ageUnit === 'weeks' ? 7 : 1);
  const passed = (calendarDay(new Date()) - calendarDay(new Date(batch.startDate))) / DAY_MS;
  return Math.round(atEntry + Math.max(passed, 0));
}

// "5 days", or with the weeks spelled out from a week on: "23 days (3 wk 2 d)"
export function batchAge(batch, { weeks = false } = {}) {
  const days = batchAgeDays(batch);
  const text = `${formatNumber(days)} ${days === 1 ? 'day' : 'days'}`;
  if (!weeks || days < 7) return text;
  return `${text} (${Math.floor(days / 7)} wk${days % 7 ? ` ${days % 7} d` : ''})`;
}

// The age tag of a brooding house: the age of the birds in it now. null for any
// other coop, for a brooding house with no live birds, and for one holding
// batches of different ages (each batch shows its own age instead).
// `entries` are its { batch, coop } pairs.
export function broodingAge(coopName, entries) {
  if (placeType(coopName) !== 'brooding') return null;
  const ages = new Set(
    entries.filter(({ coop }) => coopLive(coop) > 0).map(({ batch }) => batchAgeDays(batch)),
  );
  if (ages.size !== 1) return null;
  const [age] = ages;
  return `${formatNumber(age)} ${age === 1 ? 'day' : 'days'}`;
}

// Birds are fed this many times a day, the next feed about this many hours after the last
export const FEEDS_PER_DAY = 2;
export const FEED_GAP_HOURS = 10;

const localDay = (value) => new Date(value).toLocaleDateString('en-CA');

// How today's feeding of a coop stands, from its feed records:
//   count – feeds entered for today
//   due   – another feed is needed now: none yet today, or fewer than
//           FEEDS_PER_DAY and the last one was FEED_GAP_HOURS or more ago
//   text  – the same in words, e.g. "Fed once today, 10 hours ago. Next feed is due."
export function feedStatus(feeds, now = new Date()) {
  const today = feeds.filter((feed) => localDay(feed.date) === localDay(now));
  const count = today.length;
  if (count === 0) return { count, due: true, text: 'Not fed today yet.' };

  const last = Math.max(...today.map((feed) => new Date(feed.createdAt).getTime()));
  const hours = Math.max(0, Math.floor((now - last) / (60 * 60 * 1000)));
  const ago = hours === 0 ? 'less than an hour ago' : `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const times = count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;
  const due = count < FEEDS_PER_DAY && hours >= FEED_GAP_HOURS;
  return {
    count,
    due,
    text: `Fed ${times} today, last ${ago}.${due ? ' Next feed is due.' : ''}`,
  };
}

// Birds older than this many days are no longer put in a brooding house.
// Matches BROODING_MAX_DAYS in server/src/age.js.
export const BROODING_MAX_DAYS = 30;

// The coops a batch's birds can be put in, out of a farm's listed coop names:
// all of them, minus the brooding houses once the batch has outgrown brooding.
// Without a batch (none chosen yet) every coop is offered.
export const coopsForBatch = (names, batch) =>
  batch && batchAgeDays(batch) > BROODING_MAX_DAYS
    ? names.filter((name) => placeType(name) !== 'brooding')
    : names;

// A coop holds one batch at a time. The batch other than `batch` that still has
// live birds in the named coop of the farm, or undefined when it is free for
// `batch` (leave `batch` out to ask whether any batch is in it).
export function coopOccupant(batches, farm, coopName, batch) {
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return batches.find(
    (other) =>
      other._id !== batch?._id &&
      (other.coops ?? []).some(
        (coop) =>
          same(coop.name, coopName) && same(coopFarm(other, coop), farm) && coopLive(coop) > 0,
      ),
  );
}

// Birds leave the brooding house for a coop once they are this many days old
export const BROODING_DAYS = 28;

// The batches in a brooding house that are old enough to move to a coop:
// [{ batch, coop, age, birds }]. Empty for any other coop.
export function broodingDue(coopName, entries) {
  if (placeType(coopName) !== 'brooding') return [];
  return entries
    .map(({ batch, coop }) => ({ batch, coop, age: batchAgeDays(batch), birds: coopLive(coop) }))
    .filter((entry) => entry.birds > 0 && entry.age >= BROODING_DAYS);
}

// Birds that arrived alive and have to be allocated to coops
export const placedBirds = (batch) => batch.numberOfBirds - batch.boxMortality;

// Mortality on arrival plus everything registered in the coops since
export const totalMortality = (batch) =>
  batch.boxMortality + (batch.coops ?? []).reduce((sum, coop) => sum + (coop.mortality ?? 0), 0);

export const liveBirds = (batch) => batch.numberOfBirds - totalMortality(batch);

export const coopLive = (coop) => coop.birds - (coop.mortality ?? 0);

export const allocatedBirds = (batch) =>
  (batch.coops ?? []).reduce((sum, coop) => sum + coop.birds, 0);

export const unallocatedBirds = (batch) => placedBirds(batch) - allocatedBirds(batch);

// How many photos a mortality or vaccination record has: the first, plus any more
export const photoCount = (record) => 1 + (record.morePhotos?.length ?? 0);

// Where birds were lost. Box mortality (dead on arrival) is entered with the
// batch; the other three are registered as mortality records.
export const MORTALITY_LABELS = { box: 'Box', shift: 'Shift', brooding: 'Brooding', coop: 'Coop' };
export const RECORD_MORTALITY_TYPES = ['shift', 'brooding', 'coop'];

// A brooding house or an ordinary coop, going by the coop's name
export const placeType = (coopName) =>
  /^brooding\b/i.test((coopName ?? '').trim()) ? 'brooding' : 'coop';

// Records made before mortality had types go by their coop
export const mortalityType = (record) => record.type ?? placeType(record.coopName);

export const mortalityLabel = (record) => `${MORTALITY_LABELS[mortalityType(record)]} mortality`;

// Birds in the batch that have had at least one vaccine. The same birds get
// several vaccines over time, so per coop this takes the best-covered vaccine
// (doses of one vaccine add up across rounds) and never more than the live birds.
export function vaccinatedBirds(batch, vaccinations) {
  return (batch.coops ?? []).reduce((total, coop) => {
    const byVaccine = new Map();
    for (const record of vaccinations) {
      if (record.coopId !== coop._id) continue;
      const vaccine = record.vaccine.trim().toLowerCase();
      byVaccine.set(vaccine, (byVaccine.get(vaccine) ?? 0) + record.birds);
    }
    const covered = Math.max(0, ...byVaccine.values());
    return total + Math.min(covered, coopLive(coop));
  }, 0);
}

// The farm a coop entry is on: the batch's own, unless birds were shifted to
// a coop on another farm
export const coopFarm = (batch, coop) => (coop.farm || batch.shiftToFarm || '').trim();

// Coops are stored per batch. The same physical coop holds several batches over
// time, so entries with the same name on the same farm are grouped into one coop:
// { key, name, farm, entries: [{ batch, coop }] }, entries newest batch first.
export const coopKey = (batch, coop) =>
  `${coopFarm(batch, coop).toLowerCase()}|${coop.name.trim().toLowerCase()}`;

export function coopGroups(batches) {
  const groups = new Map();
  for (const batch of batches) {
    for (const coop of batch.coops ?? []) {
      const farm = coopFarm(batch, coop);
      const key = coopKey(batch, coop);
      if (!groups.has(key)) groups.set(key, { key, name: coop.name, farm, entries: [] });
      groups.get(key).entries.push({ batch, coop });
    }
  }
  return [...groups.values()];
}

export const batchesOnFarm = (batches, farm) =>
  batches.filter((batch) => (batch.shiftToFarm ?? '').trim().toLowerCase() === farm.toLowerCase());

// What one farm holds. A batch belongs to its own ("home") farm, but shifts can
// put some of its birds in coops on another farm, so birds are counted per coop:
//   home    – batches registered to this farm
//   entries – { batch, coop } for every coop on this farm
//   present – batches with any presence here (home or shifted in)
export function farmSummary(batches, farm) {
  const onFarm = (name) => name.trim().toLowerCase() === farm.trim().toLowerCase();
  const home = batchesOnFarm(batches, farm);
  const entries = batches.flatMap((batch) =>
    (batch.coops ?? [])
      .filter((coop) => onFarm(coopFarm(batch, coop)))
      .map((coop) => ({ batch, coop }))
  );
  const present = batches.filter(
    (batch) => home.includes(batch) || entries.some((entry) => entry.batch === batch)
  );

  return {
    home,
    entries,
    present,
    // Birds not yet allocated to a coop are still on their home farm
    live:
      entries.reduce((sum, { coop }) => sum + coopLive(coop), 0) +
      home.reduce((sum, batch) => sum + unallocatedBirds(batch), 0),
    mortality:
      entries.reduce((sum, { coop }) => sum + (coop.mortality ?? 0), 0) +
      home.reduce((sum, batch) => sum + batch.boxMortality, 0),
    coopCount: new Set(entries.map(({ coop }) => coop.name.trim().toLowerCase())).size,
  };
}

// The listed coops of one farm, from the { <farm>: [coop names] } lists
export function coopsOnFarm(coopsByFarm, farm) {
  const wanted = (farm ?? '').trim().toLowerCase();
  const key = Object.keys(coopsByFarm).find((name) => name.trim().toLowerCase() === wanted);
  return key ? coopsByFarm[key] : [];
}
