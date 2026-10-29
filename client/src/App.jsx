import { useCallback, useEffect, useState } from 'react';
import { AdminContext, ApproverContext } from './admin.js';
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
import ManageFlock from './components/ManageFlock.jsx';
import RecordForm from './components/RecordForm.jsx';
import SaleForm from './components/SaleForm.jsx';
import SecurityHome from './components/SecurityHome.jsx';
import ShiftForm from './components/ShiftForm.jsx';
import Records from './components/Records.jsx';
import Users from './components/Users.jsx';

// Stroke icons for the tabs, drawn alike so they sit evenly in the bar
const TabIcon = ({ children }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <TabIcon>
        <rect x="3" y="3" width="7.5" height="9" rx="2" />
        <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
        <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
        <rect x="3" y="15" width="7.5" height="6" rx="2" />
      </TabIcon>
    ),
  },
  {
    id: 'batches',
    label: 'Batches',
    icon: (
      <TabIcon>
        <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
        <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
      </TabIcon>
    ),
  },
  // Farms and their coops share a tab
  {
    id: 'coops',
    label: 'Farms',
    icon: (
      <TabIcon>
        <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z" />
        <path d="M9.5 21v-6h5v6" />
      </TabIcon>
    ),
  },
  {
    id: 'records',
    label: 'Records',
    icon: (
      <TabIcon>
        <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5M9.5 13h6M9.5 17h6" />
      </TabIcon>
    ),
  },
  {
    id: 'feed',
    label: 'Feed',
    icon: (
      <TabIcon>
        <path d="M12 22V9" />
        <path d="M12 9c-1.4-1-1.4-3.6 0-5 1.4 1.4 1.4 4 0 5Z" />
        <path d="M12 13c-2.2 0-3.6-1.4-3.6-3.6 2.2 0 3.6 1.4 3.6 3.6Zm0 0c2.2 0 3.6-1.4 3.6-3.6-2.2 0-3.6 1.4-3.6 3.6Z" />
        <path d="M12 17.5c-2.2 0-3.6-1.4-3.6-3.6 2.2 0 3.6 1.4 3.6 3.6Zm0 0c2.2 0 3.6-1.4 3.6-3.6-2.2 0-3.6 1.4-3.6 3.6Z" />
      </TabIcon>
    ),
  },
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

  // A security guard gets the mortality screen alone; the server refuses them the rest too.
  // A farm manager gets the whole app, with only their farm in it: the server sends no more.
  const Screen = user.role === 'security' ? SecurityFlock : Flock;

  return (
    <AdminContext.Provider value={Boolean(user.isAdmin)}>
      <ApproverContext.Provider value={Boolean(user.canApproveMortality)}>
        <Screen
          key={user.id}
          user={user}
          onLogout={() => {
            logout();
            setUser(null);
          }}
        />
      </ApproverContext.Provider>
    </AdminContext.Provider>
  );
}

// `onUsers` opens the list of users, and is only given for an admin
function AppHeader({ user, onLogout, onUsers }) {
  return (
    <header className="app-header">
      <img src={logo} alt="Energy Eggs" />
      <div className="header-user">
        <h1>Flock Management</h1>
        <p>
          {user.name} ·{' '}
          {user.farm && <>{user.farm} · </>}
          {onUsers && (
            <>
              <button type="button" className="link inline" onClick={onUsers}>
                Users
              </button>{' '}
              ·{' '}
            </>
          )}
          <button type="button" className="link inline" onClick={onLogout}>
            Log out
          </button>
        </p>
      </div>
    </header>
  );
}

// The app of a security guard: mortality and nothing else, so no tabs either
function SecurityFlock({ user, onLogout }) {
  const [batches, setBatches] = useState([]);
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

  return (
    <div className="app">
      <AppHeader user={user} onLogout={onLogout} />
      <main className="app-main">
        <SecurityHome
          batches={batches}
          loading={loading}
          error={error}
          onRetry={loadBatches}
          onUpdated={(batch) =>
            setBatches((prev) => prev.map((b) => (b._id === batch._id ? batch : b)))
          }
        />
      </main>
    </div>
  );
}

function Flock({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  // Enter Batch form open over the current tab
  const [entering, setEntering] = useState(false);
  const [managingId, setManagingId] = useState(null);
  // Dashboard form in progress: 'mortality' | 'vaccination' | 'feed' | 'weight' | 'shift' | 'sale' | null
  const [action, setAction] = useState(null);
  // Said on the dashboard after a form is saved, e.g. that mortality went for approval
  const [notice, setNotice] = useState('');
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
    setNotice('');
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

  // A farm manager has their own farm alone
  const canAddFarm = user.role !== 'manager';
  const managing = batches.find((b) => b._id === managingId);
  const viewingCoop = coopKey && coopGroups(batches).find((group) => group.key === coopKey);

  return (
    <div className="app">
      <AppHeader
        user={user}
        onLogout={onLogout}
        onUsers={user.isAdmin ? () => goToTab('users') : undefined}
      />

      <main className="app-main">
        {/* Not one of the tabs: an admin reaches it from the header */}
        {!entering && tab === 'users' && (
          <Users me={user} onBack={() => goToTab('dashboard')} />
        )}
        {entering && (
          <div className="manage">
            <button type="button" className="link back" onClick={() => setEntering(false)}>
              ‹ Back
            </button>
            <BatchForm
              farms={options.farms}
              canAddFarm={canAddFarm}
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
              onSaved={({ batch, joined, options: lists }) => {
                handleUpdated(batch);
                // The batch the birds joined, or the coop lists with the new part
                if (joined) handleUpdated(joined);
                if (lists) setOptions(lists);
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
              onSaved={(batch, status) => {
                handleUpdated(batch);
                setAction(null);
                setNotice(
                  status === 'pending'
                    ? 'Mortality sent to the admin for approval. The birds come off the coop once it is approved.'
                    : ''
                );
              }}
              onCancel={() => setAction(null)}
              onNavigate={goToTab}
            />
          ) : (
            <>
              {notice && (
                <p className="hint ok" role="status">
                  {notice}
                </p>
              )}
              <Dashboard
                batches={batches}
                loading={loading}
                error={error}
                onRetry={loadBatches}
                onNavigate={goToTab}
                onAction={(next) => {
                  setNotice('');
                  setAction(next);
                }}
                onEnter={() => setEntering(true)}
                onUpdated={handleUpdated}
              />
            </>
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
          ) : farmName ? (
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
            <CoopList
              batches={batches}
              farms={options.farms}
              coopsByFarm={options.coops}
              canAddFarm={canAddFarm}
              onOptions={setOptions}
              loading={loading}
              error={error}
              onRetry={loadBatches}
              onOpen={setCoopKey}
              onOpenFarm={setFarmName}
            />
          ))}
        {!entering && tab === 'records' && (
          <Records batches={batches} onOpenBatch={openBatch} onUpdated={handleUpdated} />
        )}
        {!entering && tab === 'feed' && <Feed onOpenBatch={openBatch} />}
      </main>

      <nav className="tab-bar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => goToTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {t.id === 'batches' && batches.length > 0 && (
              <span className="tab-count">{batches.length}</span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
