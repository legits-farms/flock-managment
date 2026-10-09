// Checks on what a request sends, each refusing with a message for the person
import { badRequest } from './evidence.js';

// A text field, trimmed; '' when it was left out
export const text = (value) => (value == null ? '' : String(value).trim());

export function requiredText(value, message) {
  const result = text(value);
  if (!result) throw badRequest(message);
  return result;
}

export function parseDate(value, message) {
  const date = new Date(value ?? '');
  if (value === '' || Number.isNaN(date.getTime())) throw badRequest(message);
  return date;
}

// The id of a row, or null when what was sent cannot be one
export const parseId = (value) => (typeof value === 'string' && value ? value : null);
