// Bird-count helpers shared by the tabs

export const formatNumber = (value) => Number(value).toLocaleString('en-IN');

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
export function coopGroups(batches) {
  const groups = new Map();
  for (const batch of batches) {
    for (const coop of batch.coops ?? []) {
      const farm = coopFarm(batch, coop);
      const key = `${farm.toLowerCase()}|${coop.name.trim().toLowerCase()}`;
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
