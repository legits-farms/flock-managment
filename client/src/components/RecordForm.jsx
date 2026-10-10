import { useEffect, useState } from 'react';
import {
  addFeedType,
  addVaccine,
  createFeed,
  createMortality,
  createVaccination,
  createWeight,
  getOptions,
} from '../api.js';
import {
  FEED_TYPES,
  MORTALITY_LABELS,
  RECORD_MORTALITY_TYPES,
  VACCINATION_SCHEDULE,
  coopFarm,
  coopLive,
  formatNumber,
  formatWeight,
  placeType,
  vaccineKey,
} from '../flock.js';
import Dropdown from './Dropdown.jsx';
import OptionSelect from './OptionSelect.jsx';
import { useIsAdmin } from '../admin.js';
import PhotoCapture, { evidencePayload } from './PhotoCapture.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The coops of a batch that are on the given farm. A batch can be spread over
// several farms, so the farm is chosen first and narrows the batches and coops.
const coopsOn = (batch, farm) =>
  farm === null ? [] : batch.coops.filter((coop) => sameName(coopFarm(batch, coop), farm));

const batchesOn = (batches, farm) => batches.filter((batch) => coopsOn(batch, farm).length > 0);

// With a single choice there is nothing to pick
const only = (list) => (list.length === 1 ? list[0] : null);

// `birdsLabel` is left out when the record is not about a number of birds, and
// `photo` is set for the records that need live photo evidence
const FORMS = {
  mortality: {
    title: 'Register Mortality',
    birdsLabel: 'Mortality (No. of Birds)',
    photo: true,
    save: createMortality,
  },
  vaccination: {
    title: 'Add Vaccination',
    birdsLabel: 'No. of Birds Administered',
    photo: true,
    save: createVaccination,
  },
  feed: {
    title: 'Enter Feed',
    save: createFeed,
  },
  weight: {
    title: 'Enter Avg Weight',
    birdsLabel: 'No. of Birds Weighed',
    save: createWeight,
  },
};

// Feed is weighed out in kilos or, for a small flock, in grams
const FEED_UNITS = [
  { value: 'kg', label: 'KG' },
  { value: 'g', label: 'GM' },
];

// Average weight per bird, in grams, or null until both numbers are filled in
function averageGrams(totalKg, birds) {
  if (!(Number(totalKg) > 0 && Number(birds) > 0)) return null;
  return Math.round((Number(totalKg) * 1000) / Number(birds));
}

// Form for a mortality, vaccination, feed or weight record against one coop.
// Opened from the dashboard, or from a coop page with only that coop's batches
// to choose from.
export default function RecordForm({
  type,
  batches,
  onSaved,
  onCancel,
  onNavigate,
  backLabel = 'Dashboard',
}) {
  const config = FORMS[type];
  const isAdmin = useIsAdmin();
  // Every farm that has a coop to record against
  const farms = [
    ...new Map(
      batches.flatMap((b) => b.coops.map((c) => coopFarm(b, c))).map((f) => [f.toLowerCase(), f]),
    ).values(),
  ];

  const onlyFarm = only(farms);
  const onlyBatch = only(batchesOn(batches, onlyFarm));
  const [farm, setFarm] = useState(onlyFarm);
  const [batchId, setBatchId] = useState(onlyBatch?._id ?? '');
  const [coopId, setCoopId] = useState(
    (onlyBatch && only(coopsOn(onlyBatch, onlyFarm))?._id) ?? '',
  );
  // Mortality type picked by hand; until then it follows the chosen coop
  const [pickedType, setPickedType] = useState('');
  const [birds, setBirds] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  // vaccineKey of the chosen entry of the vaccine list, or '' until one is picked
  const [scheduled, setScheduled] = useState('');
  // Vaccines and feed types added by hand, listed after the standard ones
  const [addedVaccines, setAddedVaccines] = useState([]);
  const [addedFeedTypes, setAddedFeedTypes] = useState([]);

  useEffect(() => {
    if (type !== 'vaccination' && type !== 'feed') return;
    getOptions()
      .then((options) => {
        setAddedVaccines(options.vaccines ?? []);
        setAddedFeedTypes(options.feedTypes ?? []);
      })
      // The standard ones are still there to pick from
      .catch(() => {});
  }, [type]);

  const feedTypes = [...FEED_TYPES, ...addedFeedTypes];

  async function saveFeedType(name) {
    if (feedTypes.some((other) => sameName(other, name))) {
      throw new Error(`Feed type "${name}" is already on the list`);
    }
    const options = await addFeedType(name);
    setAddedFeedTypes(options.feedTypes);
  }

  const vaccines = [...VACCINATION_SCHEDULE, ...addedVaccines];
  const given = vaccines.find((entry) => vaccineKey(entry) === scheduled);

  async function saveVaccine(name, when) {
    const entry = { vaccine: name, when };
    if (vaccines.some((other) => vaccineKey(other) === vaccineKey(entry))) {
      throw new Error(`Vaccine "${name}" is already on the list`);
    }
    const options = await addVaccine(name, when);
    setAddedVaccines(options.vaccines);
    return vaccineKey(entry);
  }
  const [remarks, setRemarks] = useState('');
  const [feedType, setFeedType] = useState('');
  const [feedCompany, setFeedCompany] = useState('');
  // Feed quantity as typed, in the unit picked next to it
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('kg');
  const [totalWeightKg, setTotalWeightKg] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const farmBatches = batchesOn(batches, farm);
  const batch = farmBatches.find((b) => b._id === batchId);
  const batchCoops = batch ? coopsOn(batch, farm) : [];
  const coop = batchCoops.find((c) => c._id === coopId);
  const mortalityType = pickedType || (coop ? placeType(coop.name) : '');
  const average = averageGrams(totalWeightKg, birds);

  function chooseBatch(id, onFarm = farm) {
    const chosen = batches.find((b) => b._id === id);
    setBatchId(id);
    chooseCoop((chosen && only(coopsOn(chosen, onFarm))?._id) ?? '');
  }

  function chooseCoop(id) {
    setCoopId(id);
    setPickedType('');
  }

  function chooseFarm(next) {
    setFarm(next);
    chooseBatch(only(batchesOn(batches, next))?._id ?? '', next);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!batch) return setError('Please select a farm and a batch.');
    if (!coop) return setError('Please select a coop.');
    if (type === 'vaccination' && !given) return setError('Please select the vaccine.');
    if (type === 'feed' && !feedType) return setError('Please select the feed type.');
    if (config.birdsLabel && Number(birds) > coopLive(coop)) {
      return setError(`Only ${formatNumber(coopLive(coop))} live birds are in ${coop.name}.`);
    }
    if (config.photo && evidence.length === 0) return setError('Please take a live photo.');

    setSubmitting(true);
    setError('');
    try {
      const details = {
        mortality: {
          birds: Number(birds),
          type: mortalityType,
          reason,
          // An earlier day picked by an admin, at the time of day it is now
          ...(isAdmin &&
            date !== today() && {
              date: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
            }),
        },
        vaccination: {
          birds: Number(birds),
          date,
          vaccine: given?.vaccine,
          schedule: given?.when,
          remarks,
        },
        feed: {
          date,
          feedType,
          feedCompany,
          quantityKg: quantityUnit === 'g' ? Number(quantity) / 1000 : Number(quantity),
          remarks,
        },
        weight: { birds: Number(birds), date, totalWeightKg: Number(totalWeightKg), remarks },
      }[type];
      const saved = await config.save({
        batchId,
        coopId,
        ...details,
        ...evidencePayload(evidence),
      });
      onSaved(saved.batch);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (farms.length === 0) {
    return (
      <div className="status">
        <p>No coops yet. Allocate a batch to coops before adding records.</p>
        <button type="button" className="primary" onClick={() => onNavigate('batches')}>
          Go to Batches
        </button>
      </div>
    );
  }

  const remarksField = (
    <label className="field">
      <span>Remarks</span>
      <textarea
        rows="2"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Optional"
      />
    </label>
  );

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onCancel}>
        ‹ {backLabel}
      </button>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>{config.title}</h2>

        <div className="field">
          <label htmlFor="record-farm">Farm</label>
          <Dropdown
            id="record-farm"
            value={farm}
            options={farms.map((name) => ({ value: name, label: name || 'No farm' }))}
            onChange={chooseFarm}
            placeholder="Select farm"
          />
        </div>

        <div className="field">
          <label htmlFor="record-batch">Batch</label>
          <Dropdown
            id="record-batch"
            value={batchId}
            options={farmBatches.map((b) => ({ value: b._id, label: b.batchName }))}
            onChange={chooseBatch}
            placeholder={farm === null ? 'Select farm first' : 'Select batch'}
          />
        </div>

        <div className="field">
          <label htmlFor="record-coop">Coop</label>
          <Dropdown
            id="record-coop"
            value={coopId}
            options={batchCoops.map((c) => ({
              value: c._id,
              label: `${c.name} (${formatNumber(coopLive(c))} live)`,
            }))}
            onChange={chooseCoop}
            placeholder={batch ? 'Select coop' : 'Select batch first'}
          />
        </div>

        {type === 'mortality' && (
          <>
            <div className="field">
              <label htmlFor="record-mortality-type">Mortality Type</label>
              <Dropdown
                id="record-mortality-type"
                value={mortalityType}
                options={RECORD_MORTALITY_TYPES.map((value) => ({
                  value,
                  label: MORTALITY_LABELS[value],
                }))}
                onChange={setPickedType}
                placeholder={coop ? 'Select type' : 'Select coop first'}
              />
            </div>
            <p className="hint">Box mortality is entered with the batch itself.</p>
          </>
        )}

        {/* A mortality is dated when it is registered, unless an admin says otherwise */}
        {(type !== 'mortality' || isAdmin) && (
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              max={type === 'mortality' ? today() : undefined}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        )}

        {type === 'vaccination' && (
          <div className="field">
            <label htmlFor="record-vaccine">Vaccine</label>
            <OptionSelect
              id="record-vaccine"
              value={scheduled}
              options={vaccines.map((entry) => ({
                value: vaccineKey(entry),
                label: entry.vaccine,
                note: entry.when,
              }))}
              onChange={setScheduled}
              placeholder="Select vaccine"
              addLabel="Add new vaccine"
              noteLabel="Day / week (e.g. 18th Week)"
              onAdd={saveVaccine}
            />
          </div>
        )}

        {type === 'feed' && (
          <>
            <div className="field">
              <label htmlFor="record-feed-type">Feed Type</label>
              <OptionSelect
                id="record-feed-type"
                value={feedType}
                names={feedTypes}
                onChange={setFeedType}
                placeholder="Select feed type"
                addLabel="Add feed type"
                onAdd={saveFeedType}
              />
            </div>

            <label className="field">
              <span>Feed Company</span>
              <input
                type="text"
                value={feedCompany}
                onChange={(e) => setFeedCompany(e.target.value)}
                placeholder="Company the feed is from"
                required
              />
            </label>

            <div className="field">
              <label htmlFor="record-feed-quantity">Feed Quantity</label>
              <div className="input-group">
                <input
                  id="record-feed-quantity"
                  type="number"
                  inputMode="decimal"
                  min={quantityUnit === 'g' ? '1' : '0.001'}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  required
                />
                <Dropdown
                  value={quantityUnit}
                  options={FEED_UNITS}
                  onChange={setQuantityUnit}
                  ariaLabel="Feed quantity unit"
                />
              </div>
            </div>
          </>
        )}

        {type === 'vaccination' && remarksField}

        {config.birdsLabel && (
          <label className="field">
            <span>{config.birdsLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={coop ? coopLive(coop) : undefined}
              step="1"
              value={birds}
              onChange={(e) => setBirds(e.target.value)}
              placeholder={coop ? `Up to ${formatNumber(coopLive(coop))}` : '0'}
              required
            />
          </label>
        )}

        {type === 'weight' && (
          <>
            <label className="field">
              <span>Total Weight (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={totalWeightKg}
                onChange={(e) => setTotalWeightKg(e.target.value)}
                placeholder="0"
                required
              />
            </label>

            <label className="field">
              <span>Avg Weight per Bird</span>
              <input
                type="text"
                value={average === null ? '' : formatWeight(average)}
                placeholder="Worked out from the two above"
                readOnly
              />
            </label>
          </>
        )}

        {(type === 'feed' || type === 'weight') && remarksField}

        {type === 'mortality' && (
          <label className="field">
            <span>Reason</span>
            <textarea
              rows="2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Heat stress"
              required
            />
          </label>
        )}

        {config.photo && (
          <div className="field">
            <span>Photos (live, geotagged with time stamp)</span>
            <PhotoCapture value={evidence} onChange={setEvidence} />
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : config.title}
        </button>
      </form>
    </div>
  );
}
