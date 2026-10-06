const TOKEN_KEY = 'flock-token';

export const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

async function send(path, options) {
  const token = localStorage.getItem(TOKEN_KEY);
  let res;
  try {
    res = await fetch(`/api${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  // The token expired or was rejected: drop it and let the app show the login screen
  if (res.status === 401 && token) {
    logout();
    window.dispatchEvent(new Event('auth:expired'));
  }
  return res;
}

async function request(path, options) {
  const res = await send(path, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.message || 'Cannot reach the server. Is it running?');
  }
  return data;
}

export const getBatches = () => request('/batches');

export const createBatch = (batch) =>
  request('/batches', { method: 'POST', body: JSON.stringify(batch) });

// Fixed lists to pick from: { farms: [names], coops: [names] }.
// Adding to either resolves to both updated lists.
export const getOptions = () => request('/options');

export const addFarm = (name) =>
  request('/options/farms', { method: 'POST', body: JSON.stringify({ name }) });

export const addCoopName = (name) =>
  request('/options/coops', { method: 'POST', body: JSON.stringify({ name }) });

// Both coop calls resolve to the updated batch
export const addCoop = (batchId, coop) =>
  request(`/batches/${batchId}/coops`, { method: 'POST', body: JSON.stringify(coop) });

export const removeCoop = (batchId, coopId) =>
  request(`/batches/${batchId}/coops/${coopId}`, { method: 'DELETE' });

// Record calls resolve to { id, batch } with the updated batch
export const createMortality = (record) =>
  request('/mortalities', { method: 'POST', body: JSON.stringify(record) });

export const createVaccination = (record) =>
  request('/vaccinations', { method: 'POST', body: JSON.stringify(record) });

export const getAllMortalities = () => request('/mortalities?all=true');

export const getAllVaccinations = () => request('/vaccinations?all=true');

// Without a batch id these return the latest records across all batches
const forBatch = (batchId) => (batchId ? `?batch=${batchId}` : '');

export const getMortalities = (batchId) => request(`/mortalities${forBatch(batchId)}`);

export const getVaccinations = (batchId) => request(`/vaccinations${forBatch(batchId)}`);

// Record photos need the login token, so they are fetched rather than linked.
// Resolves to an object URL; the caller revokes it when done.
export async function fetchPhoto(path) {
  const res = await send(path);
  if (!res.ok) throw new Error('Could not load the photo');
  return URL.createObjectURL(await res.blob());
}

// Both resolve to the logged-in user and remember the token
async function authenticate(path, credentials) {
  const { token, user } = await request(path, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  localStorage.setItem(TOKEN_KEY, token);
  return user;
}

export const login = (credentials) => authenticate('/auth/login', credentials);

export const signup = (credentials) => authenticate('/auth/signup', credentials);

export const getMe = () => request('/auth/me');
