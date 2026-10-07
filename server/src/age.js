import { badRequest } from './evidence.js';
import { placeType } from './models/Mortality.js';

// Birds older than this many days are no longer put in a brooding house
export const BROODING_MAX_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const calendarDay = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

// How old the batch's birds are today, in days: their age when the batch
// started plus the days that have passed since its start date
export function batchAgeDays(batch) {
  const atEntry = batch.age * (batch.ageUnit === 'weeks' ? 7 : 1);
  const passed = (calendarDay(new Date()) - calendarDay(new Date(batch.startDate))) / DAY_MS;
  return Math.round(atEntry + Math.max(passed, 0));
}

// Refuses to put a batch that has outgrown brooding into a brooding house
export function checkBroodingAge(batch, coopName) {
  const age = batchAgeDays(batch);
  if (placeType(coopName) === 'brooding' && age > BROODING_MAX_DAYS) {
    throw badRequest(
      `${batch.batchName} is ${age} days old. Birds over ${BROODING_MAX_DAYS} days cannot go to ${coopName}`
    );
  }
}
