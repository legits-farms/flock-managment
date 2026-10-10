// Bird-count helpers shared by the tabs

// The breeds kept on the farms
export const BREEDS = ['Sonali', 'Kadaknath', 'Aseel', 'Fayoumi', 'Quail'];

export const formatNumber = (value) => Number(value).toLocaleString('en-IN');

// A bird's weight, given in grams: "850 g", or "1.25 kg" from a kilo on
export const formatWeight = (grams) =>
  grams < 1000 ? `${formatNumber(grams)} g` : formatKg(grams / 1000);

export const formatKg = (kg) => `${formatNumber(Number(Number(kg).toFixed(2)))} kg`;

export const formatRupees = (amount) => `₹${formatNumber(Number(Number(amount).toFixed(2)))}`;

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

// The feeds given to broilers and to layers, each in the order the birds move through them
export const FEED_TYPES = [
  'Broiler Prestarter',
  'Broiler Grower',
  'Broiler Finisher',
  'Layer Prestarter',
  'Layer Starter',
  'Layer Grower',
  'Layer Phase 1',
  'Layer Phase 2',
];

// What the given feed entries come to: { kg, cost, unpricedKg, types }. Feed is
// priced at the average price per kg its feed type was bought at; `unpricedKg` is
// the feed of types never bought, which the cost leaves out. `types` splits it by
// feed type, most eaten first: [{ feedType, kg, cost }], cost null when never bought.
export function feedCost(feeds, purchases) {
  const bought = new Map();
  for (const purchase of purchases) {
    const key = purchase.feedType.trim().toLowerCase();
    const type = bought.get(key) ?? { kg: 0, amount: 0 };
    bought.set(key, {
      kg: type.kg + purchase.quantityKg,
      amount: type.amount + purchase.amount,
    });
  }

  const types = new Map();
  for (const feed of feeds) {
    const key = feed.feedType.trim().toLowerCase();
    const price = bought.get(key);
    const type = types.get(key) ?? { feedType: feed.feedType, kg: 0, cost: price ? 0 : null };
    types.set(key, {
      ...type,
      kg: type.kg + feed.quantityKg,
      cost: price ? type.cost + feed.quantityKg * (price.amount / price.kg) : null,
    });
  }

  const all = [...types.values()].sort((a, b) => b.kg - a.kg);
  const sum = (list, field) => list.reduce((total, type) => total + type[field], 0);
  return {
    kg: sum(all, 'kg'),
    cost: sum(all.filter((type) => type.cost !== null), 'cost'),
    unpricedKg: sum(all.filter((type) => type.cost === null), 'kg'),
    types: all,
  };
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

// Birds sold out of the batch's coops
export const totalSold = (batch) =>
  (batch.coops ?? []).reduce((sum, coop) => sum + (coop.sold ?? 0), 0);

export const liveBirds = (batch) => batch.numberOfBirds - totalMortality(batch) - totalSold(batch);

export const coopLive = (coop) => coop.birds - (coop.mortality ?? 0) - (coop.sold ?? 0);

export const allocatedBirds = (batch) =>
  (batch.coops ?? []).reduce((sum, coop) => sum + coop.birds, 0);

export const unallocatedBirds = (batch) => placedBirds(batch) - allocatedBirds(batch);

// How many photos a mortality or vaccination record has: the first, plus any more
export const photoCount = (record) => 1 + (record.morePhotos?.length ?? 0);

// Where birds were lost. Box mortality (dead on arrival) is entered with the
// batch; the other three are registered as mortality records.
export const MORTALITY_LABELS = { box: 'Box', shift: 'Shift', brooding: 'Brooding', coop: 'Coop' };
export const RECORD_MORTALITY_TYPES = ['shift', 'brooding', 'coop'];

// How much of a sale's bill has been paid, and how
export const PAYMENT_STATUS_LABELS = { unpaid: 'Unpaid', partial: 'Partly Paid', paid: 'Paid' };
export const PAYMENT_MODE_LABELS = { cash: 'Cash', upi: 'UPI', bank: 'Bank Transfer' };

// Whose boxes sold birds leave in
export const BOX_MODE_LABELS = {
  own: 'Brought their own',
  borrow: 'Borrowed from us',
  buy: 'Bought from us',
};

// Weight of the birds in one weighed set of a sale: the loaded boxes less the empty ones
export const setWeightKg = (set) =>
  Number(
    Math.max(0, (Number(set.boxWeightGross) || 0) - (Number(set.boxWeightEmpty) || 0)).toFixed(3),
  );

// What one weighed set of a saved sale was billed at. Per piece: its share of
// what the sale's males and females came to. Per kg: its weight at the sale's rate per kg, or at
// its gender's rate when the set has one.
export const saleSetBill = (sale, set) =>
  sale.billBy === 'piece'
    ? // The males and females are counted for the whole sale, so a set takes its share by birds
      (sale.birds > 0 ? set.birds / sale.birds : 0) * (sale.maleBill + sale.femaleBill)
    : set.weightKg *
      (set.gender === 'female'
        ? sale.femaleRate
        : set.gender === 'male'
          ? sale.maleRate
          : sale.ratePerKg);

// How many males and females a sale holds, e.g. "120 male · 80 female"; '' when
// they were not counted
export const genderCounts = (sale) =>
  [
    sale.maleBirds > 0 && `${formatNumber(sale.maleBirds)} male`,
    sale.femaleBirds > 0 && `${formatNumber(sale.femaleBirds)} female`,
  ]
    .filter(Boolean)
    .join(' · ');

// What a sale comes to, plus any boxes bought. Billed per kg (`billBy` 'kg') it
// is the weight of every set at one rate per kg; per piece ('piece') every male
// at one price and every female at another, as counted for the whole sale. Matches the sums in
// server/src/routes/sales.js.
export function saleTotals({
  sets,
  maleBirds: males,
  femaleBirds: females,
  billBy,
  ratePerKg,
  maleRate,
  femaleRate,
  boxMode,
  boxQty,
  boxRate,
}) {
  const total = (field) => sets.reduce((sum, set) => sum + (set[field] || 0), 0);
  const rupees = (value) => Number(value.toFixed(2));
  const perPiece = billBy === 'piece';
  const birds = total('birds');
  // Counted once all the sets are weighed
  const maleBirds = Number(males) || 0;
  const femaleBirds = Number(females) || 0;
  const weightKg = Number(sets.reduce((sum, set) => sum + setWeightKg(set), 0).toFixed(3));
  const birdBill = perPiece ? 0 : rupees(weightKg * (Number(ratePerKg) || 0));
  const maleBill = perPiece ? rupees(maleBirds * (Number(maleRate) || 0)) : 0;
  const femaleBill = perPiece ? rupees(femaleBirds * (Number(femaleRate) || 0)) : 0;
  const boxBill = boxMode === 'buy' ? rupees((Number(boxQty) || 0) * (Number(boxRate) || 0)) : 0;
  return {
    birds,
    maleBirds,
    femaleBirds,
    weightKg,
    avgKg: birds > 0 ? weightKg / birds : 0,
    birdBill,
    maleBill,
    femaleBill,
    boxBill,
    amount: rupees(birdBill + maleBill + femaleBill + boxBill),
  };
}

// A brooding house or an ordinary coop, going by the coop's name
export const placeType = (coopName) =>
  /^brooding\b/i.test((coopName ?? '').trim()) ? 'brooding' : 'coop';

// Records made before mortality had types go by their coop
export const mortalityType = (record) => record.type ?? placeType(record.coopName);

export const mortalityLabel = (record) => `${MORTALITY_LABELS[mortalityType(record)]} mortality`;

// The vaccination schedule: what is given, and the age of the birds it is given at
export const VACCINATION_SCHEDULE = [
  { when: 'Day old', vaccine: 'Mareks (SB1+HVT)' },
  { when: '5th Day', vaccine: 'Lasota' },
  { when: '12th Day', vaccine: 'IBD Plus' },
  { when: '22nd Day', vaccine: 'IBD Plus' },
  { when: '28th Day', vaccine: 'IB+Lasota Booster' },
  { when: '32nd Day', vaccine: 'Debeaking' },
  { when: '35th Day', vaccine: 'Fowl Pox' },
  { when: '43rd Day', vaccine: 'VvND K' },
  { when: '56th Day', vaccine: 'Lasota Booster' },
  { when: '9th Week', vaccine: 'ND VISA K' },
  { when: '10th Week', vaccine: 'Deworming' },
  { when: '11th Week', vaccine: 'R2B' },
  { when: '12th Week', vaccine: 'IB Live' },
  { when: '13th Week', vaccine: 'Debeaking (If needed)' },
  { when: '14th Week', vaccine: 'Deworming' },
  { when: '15.3th Week', vaccine: 'VvND K' },
  { when: '16.3th Week', vaccine: 'Lasota' },
  { when: '17th Week', vaccine: 'ND+IB Multi killed' },
];

// Tells apart the entries of the vaccine list: the same vaccine is given at several ages
export const vaccineKey = ({ vaccine, when }) => `${vaccine}|${when}`.toLowerCase();

// The age in days a schedule entry falls on, read from its wording: "Day old" is
// 0, "5th Day" 5, "9th Week" 63 and "15.3th Week" 15 weeks and 3 days. null when
// the wording gives no age, as a hand-added vaccine's may not.
export function scheduleDay(when) {
  const text = (when ?? '').trim().toLowerCase();
  if (/^day\s*old$/.test(text)) return 0;
  const match = /^(\d+)(?:\.(\d+))?\s*(?:st|nd|rd|th)?\s*(day|week)s?$/.exec(text);
  if (!match) return null;
  return match[3] === 'week' ? Number(match[1]) * 7 + Number(match[2] ?? 0) : Number(match[1]);
}

// Where one batch stands on the vaccination `schedule` ([{ vaccine, when }]),
// going by its `vaccinations` records. One row per entry that has an age, oldest
// first: { vaccine, when, day, status, late, pending }.
//   status  – 'done', 'due' (the birds are old enough and some have not had it),
//             'upcoming', or 'optional' for an "if needed" entry not given
//   late    – days the birds are past the entry's age (negative while upcoming)
//   pending – [{ coop, birds }] still to be given it, out of `coops`
// Vaccines due before the batch arrived are left out: the birds came with those.
// A vaccine follows the birds when they are shifted, so a coop counts as done
// once the batch as a whole has had enough doses for its live birds.
export function vaccinationStatus(batch, schedule, vaccinations, coops = batch.coops ?? []) {
  const live = (batch.coops ?? []).filter((coop) => coopLive(coop) > 0);
  const here = coops.filter((coop) => coopLive(coop) > 0);
  if (here.length === 0) return [];

  const age = batchAgeDays(batch);
  const ageAtEntry = batch.age * (batch.ageUnit === 'weeks' ? 7 : 1);
  const own = vaccinations.filter((record) => (record.batch?._id ?? record.batch) === batch._id);
  const batchLive = live.reduce((sum, coop) => sum + coopLive(coop), 0);

  return schedule
    .map((entry) => ({ ...entry, day: scheduleDay(entry.when) }))
    .filter((entry) => entry.day !== null && entry.day >= ageAtEntry)
    .sort((a, b) => a.day - b.day)
    .map((entry) => {
      const given = own.filter(
        (record) =>
          vaccineKey({ vaccine: record.vaccine, when: record.schedule ?? '' }) === vaccineKey(entry),
      );
      const doses = (list) => list.reduce((sum, record) => sum + record.birds, 0);
      const batchShort = Math.max(0, batchLive - doses(given));
      const pending = here
        .map((coop) => ({
          coop,
          birds: Math.min(
            coopLive(coop) - doses(given.filter((record) => record.coopId === coop._id)),
            batchShort,
          ),
        }))
        .filter(({ birds }) => birds > 0);

      const late = age - entry.day;
      const status =
        pending.length === 0
          ? 'done'
          : /if needed/i.test(entry.vaccine)
            ? 'optional'
            : late >= 0
              ? 'due'
              : 'upcoming';
      return { vaccine: entry.vaccine, when: entry.when, day: entry.day, status, late, pending };
    });
}

// The vaccines the birds of the given { batch, coop } pairs are old enough for
// but have not all had, earliest first, as "Lasota (5th Day)"
export function dueVaccineNames(entries, schedule, vaccinations) {
  const batches = [...new Map(entries.map(({ batch }) => [batch._id, batch])).values()];
  const due = batches.flatMap((batch) =>
    vaccinationStatus(
      batch,
      schedule,
      vaccinations,
      entries.filter((entry) => entry.batch._id === batch._id).map((entry) => entry.coop),
    ).filter((row) => row.status === 'due'),
  );
  return [
    ...new Set(due.sort((a, b) => a.day - b.day).map((row) => `${row.vaccine} (${row.when})`)),
  ];
}

// Every vaccine some birds are old enough for but have not had, across all the
// batches, earliest in the schedule first: [{ vaccine, when, coops: [{ batch, coop, birds }] }]
export function vaccinesDue(batches, schedule, vaccinations) {
  const due = new Map();
  for (const batch of batches) {
    for (const row of vaccinationStatus(batch, schedule, vaccinations)) {
      if (row.status !== 'due') continue;
      const key = vaccineKey(row);
      if (!due.has(key)) due.set(key, { vaccine: row.vaccine, when: row.when, day: row.day, coops: [] });
      due.get(key).coops.push(...row.pending.map((entry) => ({ batch, ...entry })));
    }
  }
  return [...due.values()].sort((a, b) => a.day - b.day);
}

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
