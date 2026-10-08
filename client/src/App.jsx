import { useCallback, useEffect, useState } from 'react';
import { getBatches, getMe, getOptions, hasToken, logout } from './api.js';
import { coopGroups, coopsOnFarm } from './flock.js';
import logo from './assets/logo.webp';
import AuthScreen from './components/AuthScreen.jsx';
import BatchForm from './components/BatchForm.jsx';
import BatchList from './components/BatchList.jsx';
import CoopList from './components/CoopList.jsx';
import CoopPage from './components/CoopPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import FarmPage from './components/FarmPage.jsx';
import Feed from './components/Feed.jsx';
import Farms from './components/Farms.jsx';
import ManageFlock from './components/ManageFlock.jsx';
import RecordForm from './components/RecordForm.jsx';
import SaleForm from './components/SaleForm.jsx';
import ShiftForm from './components/ShiftForm.jsx';
import Records from './components/Records.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'batches', label: 'Batches', icon: '☰' },
  { id: 'coops', label: 'Coops', icon: '⌂' },
  { id: 'records', label: 'Records', icon: '▤' },
  { id: 'feed', label: 'Feed', icon: '≡' },
  { id: 'farms', label: 'Farms', icon: '◈' },
];

export default function App() {
  // undefined while checking a saved login, null when logged out
  const [user, setUser] = useState(() => (hasToken() ? undefined : null));

  useEffect(() => {
    if (user === undefined) {
      getMe()
        .then(setUser)
        .catch(() => setUser(null));
    }
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [user]);

  if (user === undefined) return <p className="status">Loading…</p>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;

  return (
    <Flock
      key={user.id}
      user={user}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  );
}

function Flock({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  // Enter Batch form open over the current tab
  const [entering, setEntering] = useState(false);
  const [managingId, setManagingId] = useState(null);
  // Dashboard form in progress: 'mortality' | 'vaccination' | 'feed' | 'weight' | 'shift' | 'sale' | null
  const [action, setAction] = useState(null);
  // Coop and batch the shift form starts on: { coopKey, batchId }, or null
  const [shiftFrom, setShiftFrom] = useState(null);
  // Key of the coop page being viewed (see coopGroups), or null
  const [coopKey, setCoopKey] = useState(null);
  // Name of the farm page being viewed, or null
  const [farmName, setFarmName] = useState(null);
  const [batches, setBatches] = useState([]);
  // Fixed lists to pick from: farms, and each farm's coops
  const [options, setOptions] = useState({ farms: [], coops: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBatches(await getBatches());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Refreshed whenever a form that uses the lists opens, so a failed first load
  // or a farm / coop added on another phone does not leave the dropdowns stale
  useEffect(() => {
    getOptions()
      .then(setOptions)
      .catch(() => {});
  }, [entering, managingId, tab, action]);

  function handleRegistered(batch) {
    setBatches((prev) => [batch, ...prev]);
    // Go straight to coop allocation for the new batch
    setEntering(false);
    setManagingId(batch._id);
    setTab('batches');
  }

  function handleUpdated(batch) {
    setBatches((prev) => prev.map((b) => (b._id === batch._id ? batch : b)));
  }

  function goToTab(id) {
    setEntering(false);
    setManagingId(null);
    setAction(null);
    setShiftFrom(null);
    setCoopKey(null);
    setFarmName(null);
    setTab(id);
  }

  // Opens the shift form, ready to move the given batch out of the given coop
  function openShift(from) {
    goToTab('dashboard');
    setShiftFrom(from);
    setAction('shift');
  }

  function openCoop(key) {
    goToTab('coops');
    setCoopKey(key);
  }

  function openBatch(id) {
    goToTab('batches');
    setManagingId(id);
  }

  const managing = batches.find((b) => b._id === managingId);
  const viewingCoop = coopKey && coopGroups(batches).find((group) => group.key === coopKey);

  return (
    <div className="app">
      <header className="app-header">
        <img src={logo} alt="Energy Eggs" />
        <div className="header-user">
          <h1>Flock Management</h1>
          <p>
            {user.name} ·{' '}
            <button type="button" className="link inline" onClick={onLogout}>
              Log out
            </button>
          </p>
        </div>
      </header>

      <main className="app-main">
        {entering && (
          <div className="manage">
            <button type="button" className="link back" onClick={() => setEntering(false)}>
              ‹ Back
            </button>
            <BatchForm
              farms={options.farms}
              onOptions={setOptions}
              onRegistered={handleRegistered}
            />
          </div>
        )}
        {!entering &&
          tab === 'dashboard' &&
          (action === 'shift' ? (
            <ShiftForm
              from={shiftFrom}
              batches={batches}
              farms={options.farms}
              coopsByFarm={options.coops}
              onSaved={(batch) => {
                handleUpdated(batch);
                setAction(null);
                setShiftFrom(null);
              }}
              onCancel={() => {
                setAction(null);
                setShiftFrom(null);
              }}
              onNavigate={goToTab}
            />
          ) : action === 'sale' ? (
            <SaleForm
              batches={batches}
              onSaved={(sold) => {
                sold.forEach(handleUpdated);
                setAction(null);
              }}
              onCancel={() => setAction(null)}
              onNavigate={goToTab}
            />
          ) : action ? (
            <RecordForm
              key={action}
              type={action}
              batches={batches}
              onSaved={(batch) => {
                handleUpdated(batch);
                setAction(null);
              }}
              onCancel={() => setAction(null)}
              onNavigate={goToTab}
            />
          ) : (
            <Dashboard
              batches={batches}
              loading={loading}
              error={error}
              onRetry={loadBatches}
              onNavigate={goToTab}
              onAction={setAction}
              onEnter={() => setEntering(true)}
            />
          ))}
        {!entering &&
          tab === 'batches' &&
          (managing ? (
            <ManageFlock
              key={managing._id}
              batch={managing}
              allBatches={batches}
              farms={options.farms}
              coopsByFarm={options.coops}
              onOptions={setOptions}
              onUpdated={handleUpdated}
              onBack={() => setManagingId(null)}
              onOpenCoop={openCoop}
              onShift={openShift}
            />
          ) : (
            <BatchList
              batches={batches}
              loading={loading}
              error={error}
              onRetry={loadBatches}
              onManage={setManagingId}
              onEnter={() => setEntering(true)}
            />
          ))}
        {!entering &&
          tab === 'coops' &&
          (viewingCoop ? (
            <CoopPage
              key={viewingCoop.key}
              group={viewingCoop}
              onBack={() => setCoopKey(null)}
              onOpenBatch={openBatch}
              onUpdated={handleUpdated}
            />
          ) : (
            <CoopList
              batches={batches}
              farms={options.farms}
              coopsByFarm={options.coops}
              onOptions={setOptions}
              loading={loading}
              error={error}
              onRetry={loadBatches}
              onOpen={setCoopKey}
              onNavigate={goToTab}
            />
          ))}
        {!entering && tab === 'records' && (
          <Records batches={batches} onOpenBatch={openBatch} onUpdated={handleUpdated} />
        )}
        {!entering && tab === 'feed' && <Feed onOpenBatch={openBatch} />}
        {!entering &&
          tab === 'farms' &&
          (farmName ? (
            <FarmPage
              key={farmName}
              farm={farmName}
              allBatches={batches}
              coopNames={coopsOnFarm(options.coops, farmName)}
              onOptions={setOptions}
              onBack={() => setFarmName(null)}
              onOpenBatch={openBatch}
              onOpenCoop={openCoop}
            />
          ) : (
            <Farms
              farms={options.farms}
              batches={batches}
              onOptions={setOptions}
              onOpen={setFarmName}
            />
          ))}
      </main>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => goToTab(t.id)}
          >
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
            {t.id === 'batches' && batches.length > 0 && (
              <span className="tab-count">{batches.length}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
