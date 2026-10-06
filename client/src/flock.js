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

// Coops are stored per batch. The same physical coop holds several batches over
// time, so entries with the same name on the same farm are grouped into one coop:
// { key, name, farm, entries: [{ batch, coop }] }, entries newest batch first.
export function coopGroups(batches) {
  const groups = new Map();
  for (const batch of batches) {
    const farm = (batch.shiftToFarm ?? '').trim();
    for (const coop of batch.coops ?? []) {
      const key = `${farm.toLowerCase()}|${coop.name.trim().toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { key, name: coop.name, farm, entries: [] });
      groups.get(key).entries.push({ batch, coop });
    }
  }
  return [...groups.values()];
}

export const batchesOnFarm = (batches, farm) =>
  batches.filter((batch) => (batch.shiftToFarm ?? '').trim().toLowerCase() === farm.toLowerCase());
