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

// Fixed lists to pick from: { farms: [names], coops: { <farm>: [coop names] } }.
// Adding to either resolves to both updated lists.
export const getOptions = () => request('/options');

export const addFarm = (name) =>
  request('/options/farms', { method: 'POST', body: JSON.stringify({ name }) });

export const addCoopName = (farm, name) =>
  request('/options/coops', { method: 'POST', body: JSON.stringify({ farm, name }) });

export const addVaccine = (name, schedule) =>
  request('/options/vaccines', { method: 'POST', body: JSON.stringify({ name, schedule }) });

export const addFeedType = (name) =>
  request('/options/feed-types', { method: 'POST', body: JSON.stringify({ name }) });

// Both coop calls resolve to the updated batch
export const addCoop = (batchId, coop) =>
  request(`/batches/${batchId}/coops`, { method: 'POST', body: JSON.stringify(coop) });

// Record calls resolve to { id, batch } with the updated batch
export const createMortality = (record) =>
  request('/mortalities', { method: 'POST', body: JSON.stringify(record) });

export const createVaccination = (record) =>
  request('/vaccinations', { method: 'POST', body: JSON.stringify(record) });

export const createFeed = (record) =>
  request('/feeds', { method: 'POST', body: JSON.stringify(record) });

export const createWeight = (record) =>
  request('/weights', { method: 'POST', body: JSON.stringify(record) });

// Resolves to { id, batch } with the updated batch
export const createShift = (shift) =>
  request('/shifts', { method: 'POST', body: JSON.stringify(shift) });

// Resolves to { id, batches } with every batch birds were sold from
export const createSale = (sale) =>
  request('/sales', { method: 'POST', body: JSON.stringify(sale) });

export const getAllSales = () => request('/sales?all=true');

// Feed bought into the store, newest first. Adding one resolves to the saved purchase.
export const getFeedPurchases = () => request('/feed-purchases');

export const createFeedPurchase = (purchase) =>
  request('/feed-purchases', { method: 'POST', body: JSON.stringify(purchase) });

export const getAllShifts = () => request('/shifts?all=true');

export const getAllMortalities = () => request('/mortalities?all=true');

// Mortality a security guard registered that an admin has not decided on yet
export const getPendingMortalities = () => request('/mortalities?status=pending&all=true');

// `decision` is 'approve' or 'reject'. Resolves to { id, status, batch } with the updated batch.
export const decideMortality = (id, decision) =>
  request(`/mortalities/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });

export const getAllVaccinations = () => request('/vaccinations?all=true');

export const getAllFeeds = () => request('/feeds?all=true');

export const getAllWeights = () => request('/weights?all=true');

// Without a batch id these return the latest records across all batches
const forBatch = (batchId) => (batchId ? `?batch=${batchId}` : '');

export const getMortalities = (batchId) => request(`/mortalities${forBatch(batchId)}`);

export const getVaccinations = (batchId) => request(`/vaccinations${forBatch(batchId)}`);

export const getFeeds = (batchId) => request(`/feeds${forBatch(batchId)}`);

export const getWeights = (batchId) => request(`/weights${forBatch(batchId)}`);

// Record photos need the login token, so they are fetched rather than linked.
// Resolves to an object URL; the caller revokes it when done.
export async function fetchPhoto(path) {
  const res = await send(path);
  if (!res.ok) throw new Error('Could not load the photo');
  return URL.createObjectURL(await res.blob());
}

// Resolves to the logged-in user and remembers the token
async function authenticate(path, credentials) {
  const { token, user } = await request(path, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  localStorage.setItem(TOKEN_KEY, token);
  return user;
}

export const login = (credentials) => authenticate('/auth/login', credentials);

// A new account waits for the manager's approval, so nobody is logged in yet.
// Resolves to { pending: true, message }.
export const signup = (credentials) =>
  request('/auth/signup', { method: 'POST', body: JSON.stringify(credentials) });

export const getMe = () => request('/auth/me');

// Everyone with an account, for an admin: [{ _id, name, phone, role, status, createdAt }]
export const getUsers = () => request('/users');

// `role` is 'user' or 'security'. Resolves to the updated user.
export const setUserRole = (id, role) =>
  request(`/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) });

export const getShifts = (batchId) => request(`/shifts${forBatch(batchId)}`);

// A sale can hold birds from several batches; this lists every sale with some from this one
export const getSales = (batchId) => request(`/sales${forBatch(batchId)}`);
