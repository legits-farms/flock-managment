import { useState } from 'react';
import { createSale } from '../api.js';
import {
  BOX_MODE_LABELS,
  BREEDS,
  PAYMENT_MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  coopGroups,
  coopLive,
  formatKg,
  formatNumber,
  formatRupees,
  saleTotals,
  setWeightKg,
} from '../flock.js';
import Dropdown from './Dropdown.jsx';
import PhotoCapture from './PhotoCapture.jsx';

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

const onlyDigits = (value) => value.replace(/\D/g, '');

// "+91 98765-43210" -> "9876543210"
function mobileNumber(value) {
  let digits = onlyDigits(value);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

// A picture picked from the phone's files or gallery, scaled down to a JPEG data
// URL small enough to send with the sale
async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}


// A GST number (GSTIN), e.g. 27ABCDE1234F1Z5
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

const BILL_BY_LABELS = { kg: 'Per kg', piece: 'Per piece' };

const NO_WEIGHING = { birds: '', boxes: '', boxWeightEmpty: '', boxWeightGross: '' };

// Match MAX_SET_PHOTOS and MAX_SALE_PHOTOS in server/src/models/Sale.js
const MAX_SET_PHOTOS = 2;
const MAX_SALE_PHOTOS = 8;

// Dashboard form for selling live birds. The birds are weighed out in sets, each
// out of one coop. Once they all are, the males and females are counted, and the
// sale is billed either per kg at one rate or per piece at a price for a male
// and one for a female.
export default function SaleForm({ batches, onSaved, onCancel, onNavigate }) {
  // Only coops that still hold live birds can be sold from
  const groups = coopGroups(batches)
    .map((group) => ({
      ...group,
      entries: group.entries.filter(({ coop }) => coopLive(coop) > 0),
    }))
    .filter((group) => group.entries.length > 0);
  const farms = [...new Map(groups.map((g) => [g.farm.toLowerCase(), g.farm])).values()];

  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [business, setBusiness] = useState('');
  const [gstin, setGstin] = useState('');
  // What the customer asked for, noted before the birds are weighed
  const [requirement, setRequirement] = useState({ birds: '', breed: '', avgWeightKg: '' });
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  // The sets weighed so far, and the one being entered
  const [sets, setSets] = useState([]);
  const [farm, setFarm] = useState(farms.length === 1 ? farms[0] : null);
  const [coopKey, setCoopKey] = useState('');
  const [batchId, setBatchId] = useState('');
  const [weighing, setWeighing] = useState(NO_WEIGHING);
  // Live photos of the set being entered
  const [photos, setPhotos] = useState([]);

  // How many of the birds in all the sets are male and how many female
  const [maleBirds, setMaleBirds] = useState('');
  const [femaleBirds, setFemaleBirds] = useState('');

  // 'kg': on the weight, at one rate. 'piece': a price for each male and each female.
  const [billBy, setBillBy] = useState('kg');
  const [ratePerKg, setRatePerKg] = useState('');
  const [maleRate, setMaleRate] = useState('');
  const [femaleRate, setFemaleRate] = useState('');
  const [boxMode, setBoxMode] = useState('own');
  const [boxQty, setBoxQty] = useState('');
  const [boxRate, setBoxRate] = useState('');
  const [boxReturned, setBoxReturned] = useState('');
  // People there when the birds were weighed, and the one being entered
  const [present, setPresent] = useState([]);
  const [person, setPerson] = useState({ name: '', phone: '' });

  // What has been paid towards the bill: 'unpaid' | 'partial' | 'paid'
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  // Picture of the payment, as a data URL, or '' when none was added
  const [paymentProof, setPaymentProof] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const farmGroups = groups.filter((g) => farm !== null && sameName(g.farm, farm));
  const group = farmGroups.find((g) => g.key === coopKey);
  // With a single batch in the coop it is chosen already; otherwise the person picks
  const entry =
    group?.entries.length === 1
      ? group.entries[0]
      : group?.entries.find(({ batch }) => batch._id === batchId);
  // Live birds of a coop not yet in one of the sets
  const left = (coop) =>
    coopLive(coop) -
    sets.filter((set) => set.coopId === coop._id).reduce((sum, set) => sum + set.birds, 0);
  const available = entry ? left(entry.coop) : 0;
  // Photos the set being entered can still take: a set and a whole sale each have a limit
  const photosLeft = Math.min(
    MAX_SET_PHOTOS,
    MAX_SALE_PHOTOS - sets.reduce((sum, set) => sum + set.photos.length, 0),
  );

  const totals = saleTotals({
    sets,
    maleBirds,
    femaleBirds,
    billBy,
    ratePerKg,
    maleRate,
    femaleRate,
    boxMode,
    boxQty,
    boxRate,
  });
  const boxesOut = Math.max(0, (Number(boxQty) || 0) - (Number(boxReturned) || 0));
  // Rupees received so far, and what is still owed
  const paid =
    paymentStatus === 'paid' ? totals.amount : paymentStatus === 'partial' ? Number(amountPaid) || 0 : 0;
  const balance = Math.max(0, Number((totals.amount - paid).toFixed(2)));

  async function chooseProof(e) {
    const [file] = e.target.files;
    // Lets the same picture be picked again after it is removed
    e.target.value = '';
    if (!file) return;
    try {
      setPaymentProof(await shrinkImage(file));
      setError('');
    } catch {
      setError('Could not read that picture. Please pick another one.');
    }
  }

  const setRequired = (field) => (e) =>
    setRequirement((prev) => ({ ...prev, [field]: e.target.value }));

  const setWeighed = (field) => (e) =>
    setWeighing((prev) => ({ ...prev, [field]: e.target.value }));

  function chooseFarm(next) {
    setFarm(next);
    setCoopKey('');
    setBatchId('');
  }

  function chooseCoop(key) {
    setCoopKey(key);
    setBatchId('');
  }

  function addSet() {
    const birds = Number(weighing.birds);
    if (!entry) return setError('Please select the farm, coop and batch of this set.');
    if (!Number.isInteger(birds) || birds < 1) {
      return setError('Enter the number of birds in this set.');
    }
    if (birds > available) {
      return setError(`Only ${formatNumber(available)} live birds are left in ${group.name}.`);
    }
    if (Number(weighing.boxWeightGross) < Number(weighing.boxWeightEmpty)) {
      return setError('Loaded weight cannot be less than the empty box weight.');
    }

    setError('');
    setSets((prev) => [
      ...prev,
      {
        batchId: entry.batch._id,
        batchName: entry.batch.batchName,
        coopId: entry.coop._id,
        coopName: entry.coop.name,
        birds,
        boxes: Number(weighing.boxes) || 0,
        boxWeightEmpty: Number(weighing.boxWeightEmpty) || 0,
        boxWeightGross: Number(weighing.boxWeightGross) || 0,
        photos,
      },
    ]);
    // The next set usually comes out of the same coop
    setWeighing(NO_WEIGHING);
    setPhotos([]);
  }

  function addPerson() {
    if (!person.name.trim()) return;
    setPresent((prev) => [...prev, { name: person.name.trim(), phone: person.phone }]);
    setPerson({ name: '', phone: '' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobileNumber(phone))) {
      return setError('Enter a valid 10-digit mobile number.');
    }
    if (gstin && !GSTIN.test(gstin)) return setError('Enter a valid 15-character GST number.');
    if (sets.length === 0) return setError('Record at least one set of birds.');
    if (totals.maleBirds + totals.femaleBirds !== totals.birds) {
      return setError(
        `The males and females must add up to the ${formatNumber(totals.birds)} birds in the sets.`,
      );
    }
    if (paymentStatus === 'partial' && !(paid > 0 && paid < totals.amount)) {
      return setError('The amount paid must be more than 0 and less than the total bill.');
    }
    if (paymentStatus !== 'unpaid' && !paymentMode) return setError('Please select how it was paid.');
    if (boxMode === 'borrow' && Number(boxReturned) > Number(boxQty)) {
      return setError('Boxes returned cannot be more than boxes given.');
    }

    setSubmitting(true);
    setError('');
    try {
      const saved = await createSale({
        customer: { name: customer, phone, address, business, gstin },
        requirement,
        date,
        notes,
        sets: sets.map(({ batchName, coopName, ...set }) => set),
        maleBirds: totals.maleBirds,
        femaleBirds: totals.femaleBirds,
        billBy,
        ...(billBy === 'piece'
          ? { maleRate: Number(maleRate) || 0, femaleRate: Number(femaleRate) || 0 }
          : { ratePerKg: Number(ratePerKg) || 0 }),
        boxMode,
        boxQty: Number(boxQty) || 0,
        boxRate: Number(boxRate) || 0,
        boxReturned: Number(boxReturned) || 0,
        present,
        payment:
          paymentStatus === 'unpaid'
            ? { status: 'unpaid' }
            : {
                status: paymentStatus,
                amountPaid: paid,
                mode: paymentMode,
                reference: paymentReference,
                proof: paymentProof || undefined,
              },
      });
      onSaved(saved.batches);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (groups.length === 0) {
    return (
      <div className="status">
        <p>No birds in coops yet. Allocate a batch to coops before selling birds.</p>
        <button type="button" className="primary" onClick={() => onNavigate('batches')}>
          Go to Batches
        </button>
      </div>
    );
  }

  const decimal = { type: 'number', inputMode: 'decimal', min: '0', step: 'any', placeholder: '0' };
  const whole = { type: 'number', inputMode: 'numeric', min: '0', step: '1', placeholder: '0' };

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onCancel}>
        ‹ Dashboard
      </button>

      <form className="card form" onSubmit={handleSubmit}>
        <h2>New Bird Sale</h2>

        <label className="field">
          <span>Customer</span>
          <input
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Name"
            required
          />
        </label>

        <label className="field">
          <span>Phone</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
            placeholder="10-digit mobile number"
            required
          />
        </label>

        <label className="field">
          <span>Business Name</span>
          <input
            type="text"
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            placeholder="Optional"
            maxLength={80}
          />
        </label>

        <label className="field">
          <span>GST Number</span>
          <input
            type="text"
            autoCapitalize="characters"
            maxLength={15}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.replace(/\s/g, '').toUpperCase())}
            placeholder="Optional · 15 characters"
          />
        </label>

        <label className="field">
          <span>Address</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Village / town"
          />
        </label>

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <fieldset className="group">
          <legend>Customer's Requirement</legend>

          <div className="field-row">
            <label className="field">
              <span>Birds Required</span>
              <input {...whole} min="1" value={requirement.birds} onChange={setRequired('birds')} />
            </label>
            <label className="field">
              <span>Avg Weight (kg)</span>
              <input
                {...decimal}
                value={requirement.avgWeightKg}
                onChange={setRequired('avgWeightKg')}
              />
            </label>
          </div>

          <label className="field">
            <span>Breed</span>
            <input
              type="text"
              list="sale-breeds"
              maxLength={40}
              value={requirement.breed}
              onChange={setRequired('breed')}
              placeholder="e.g. Sonali"
            />
            <datalist id="sale-breeds">
              {BREEDS.map((breed) => (
                <option key={breed} value={breed} />
              ))}
            </datalist>
          </label>
        </fieldset>

        <fieldset className="group">
          <legend>Record a Set</legend>

          <div className="field">
            <label htmlFor="sale-farm">Farm</label>
            <Dropdown
              id="sale-farm"
              value={farm}
              options={farms.map((name) => ({ value: name, label: name || 'No farm' }))}
              onChange={chooseFarm}
              placeholder="Select farm"
            />
          </div>

          <div className="field">
            <label htmlFor="sale-coop">Coop</label>
            <Dropdown
              id="sale-coop"
              value={coopKey}
              options={farmGroups.map((g) => ({
                value: g.key,
                label: `${g.name} (${formatNumber(
                  g.entries.reduce((sum, { coop }) => sum + left(coop), 0),
                )} live)`,
              }))}
              onChange={chooseCoop}
              placeholder={farm === null ? 'Select farm first' : 'Select coop'}
            />
          </div>

          <div className="field">
            <label htmlFor="sale-batch">Batch</label>
            <Dropdown
              id="sale-batch"
              value={entry?.batch._id ?? ''}
              options={(group?.entries ?? []).map(({ batch, coop }) => ({
                value: batch._id,
                label: `${batch.batchName} · ${batch.breed} (${formatNumber(left(coop))} live)`,
              }))}
              onChange={setBatchId}
              placeholder={group ? 'Select batch' : 'Select coop first'}
            />
          </div>

          <div className="field-row">
            <label className="field">
              <span>No. of Birds</span>
              <input
                {...whole}
                max={entry ? available : undefined}
                value={weighing.birds}
                onChange={setWeighed('birds')}
                placeholder={entry ? `Up to ${formatNumber(available)}` : '0'}
              />
            </label>
            <label className="field">
              <span>Boxes</span>
              <input {...whole} value={weighing.boxes} onChange={setWeighed('boxes')} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Empty Box Wt (kg)</span>
              <input
                {...decimal}
                value={weighing.boxWeightEmpty}
                onChange={setWeighed('boxWeightEmpty')}
              />
            </label>
            <label className="field">
              <span>Loaded Wt (kg)</span>
              <input
                {...decimal}
                value={weighing.boxWeightGross}
                onChange={setWeighed('boxWeightGross')}
              />
            </label>
          </div>

          <label className="field">
            <span>Bird Weight</span>
            <input type="text" value={formatKg(setWeightKg(weighing))} readOnly />
          </label>

          <div className="field">
            <span>Photos of this Set (live, geotagged with time stamp)</span>
            {photosLeft > 0 ? (
              <PhotoCapture value={photos} onChange={setPhotos} max={photosLeft} />
            ) : (
              <p className="empty">This sale already has its {MAX_SALE_PHOTOS} photos.</p>
            )}
          </div>

          <button type="button" className="secondary" onClick={addSet}>
            + Add Set
          </button>

          {sets.length > 0 && (
            <ul className="recent-list">
              {sets.map((set, i) => (
                <li key={i}>
                  <div>
                    <strong>
                      {formatNumber(set.birds)} birds · {formatKg(setWeightKg(set))}
                    </strong>
                    <small>
                      {set.coopName} · {set.batchName}
                      {set.boxes > 0 && ` · ${formatNumber(set.boxes)} boxes`}
                      {set.photos.length > 0 &&
                        ` · ${set.photos.length} ${set.photos.length === 1 ? 'photo' : 'photos'}`}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="link"
                    onClick={() => setSets((prev) => prev.filter((_, at) => at !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className="field-row">
          <label className="field">
            <span>No. of Males</span>
            <input {...whole} value={maleBirds} onChange={(e) => setMaleBirds(e.target.value)} />
          </label>
          <label className="field">
            <span>No. of Females</span>
            <input
              {...whole}
              value={femaleBirds}
              onChange={(e) => setFemaleBirds(e.target.value)}
            />
          </label>
        </div>
        {totals.birds > 0 && (
          <p className="hint">
            {formatNumber(totals.maleBirds + totals.femaleBirds)} of the{' '}
            {formatNumber(totals.birds)} birds in the sets counted
          </p>
        )}

        <div className="field">
          <span>Bill By</span>
          <div className="choice" role="group" aria-label="Bill per kg or per piece">
            {Object.entries(BILL_BY_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={billBy === value}
                className={billBy === value ? 'active' : ''}
                onClick={() => setBillBy(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {billBy === 'kg' ? (
          <label className="field">
            <span>Rate per kg (₹)</span>
            <input {...decimal} value={ratePerKg} onChange={(e) => setRatePerKg(e.target.value)} />
          </label>
        ) : (
          <div className="field-row">
            <label className="field">
              <span>Male Rate per pc (₹)</span>
              <input {...decimal} value={maleRate} onChange={(e) => setMaleRate(e.target.value)} />
            </label>
            <label className="field">
              <span>Female Rate per pc (₹)</span>
              <input
                {...decimal}
                value={femaleRate}
                onChange={(e) => setFemaleRate(e.target.value)}
              />
            </label>
          </div>
        )}

        <fieldset className="group">
          <legend>Boxes / Crates</legend>

          <div className="field">
            <label htmlFor="sale-boxes">Whose Boxes</label>
            <Dropdown
              id="sale-boxes"
              value={boxMode}
              options={Object.entries(BOX_MODE_LABELS).map(([value, label]) => ({ value, label }))}
              onChange={setBoxMode}
            />
          </div>

          {boxMode === 'borrow' && (
            <div className="field-row">
              <label className="field">
                <span>Boxes Given</span>
                <input {...whole} value={boxQty} onChange={(e) => setBoxQty(e.target.value)} />
              </label>
              <label className="field">
                <span>Already Returned</span>
                <input
                  {...whole}
                  max={boxQty || undefined}
                  value={boxReturned}
                  onChange={(e) => setBoxReturned(e.target.value)}
                />
              </label>
            </div>
          )}
          {boxMode === 'borrow' && Number(boxQty) > 0 && (
            <p className="hint">
              {boxesOut > 0
                ? `${formatNumber(boxesOut)} ${boxesOut === 1 ? 'box' : 'boxes'} to be returned`
                : 'All boxes returned'}
            </p>
          )}

          {boxMode === 'buy' && (
            <div className="field-row">
              <label className="field">
                <span>Boxes Sold</span>
                <input {...whole} value={boxQty} onChange={(e) => setBoxQty(e.target.value)} />
              </label>
              <label className="field">
                <span>Rate per Box (₹)</span>
                <input {...decimal} value={boxRate} onChange={(e) => setBoxRate(e.target.value)} />
              </label>
            </div>
          )}
        </fieldset>

        <fieldset className="group">
          <legend>Present at Sale</legend>

          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={person.name}
                onChange={(e) => setPerson((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={13}
                value={person.phone}
                onChange={(e) =>
                  setPerson((prev) => ({ ...prev, phone: onlyDigits(e.target.value) }))
                }
                placeholder="Optional"
              />
            </label>
          </div>

          <button type="button" className="secondary" onClick={addPerson}>
            + Add Person
          </button>

          {present.length > 0 && (
            <ul className="recent-list">
              {present.map((p, i) => (
                <li key={i}>
                  <div>
                    <strong>{p.name}</strong>
                    {p.phone && <small>{p.phone}</small>}
                  </div>
                  <button
                    type="button"
                    className="link"
                    onClick={() => setPresent((prev) => prev.filter((_, at) => at !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows="2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember"
          />
        </label>

        <dl className="batch-stats">
          <div>
            <dt>Total Birds</dt>
            <dd>{formatNumber(totals.birds)}</dd>
          </div>
          <div>
            <dt>Total Weight</dt>
            <dd>{formatKg(totals.weightKg)}</dd>
          </div>
          <div>
            <dt>Total Bill</dt>
            <dd>{formatRupees(totals.amount)}</dd>
          </div>
        </dl>

        {totals.birds > 0 && (
          <ul className="recent-list">
            {billBy === 'kg' ? (
              <li>
                <div>
                  <strong>
                    {formatNumber(totals.maleBirds)} male · {formatNumber(totals.femaleBirds)}{' '}
                    female
                  </strong>
                  <small>
                    {formatKg(totals.weightKg)} × {formatRupees(Number(ratePerKg) || 0)}/kg · avg{' '}
                    {formatKg(totals.avgKg)} per bird
                  </small>
                </div>
                <span>{formatRupees(totals.birdBill)}</span>
              </li>
            ) : (
              [
                ['Male', totals.maleBirds, maleRate, totals.maleBill],
                ['Female', totals.femaleBirds, femaleRate, totals.femaleBill],
              ]
                .filter(([, birds]) => birds > 0)
                .map(([label, birds, rate, bill]) => (
                  <li key={label}>
                    <div>
                      <strong>
                        {label} · {formatNumber(birds)} birds
                      </strong>
                      <small>
                        {formatNumber(birds)} × {formatRupees(Number(rate) || 0)}/pc
                      </small>
                    </div>
                    <span>{formatRupees(bill)}</span>
                  </li>
                ))
            )}
            {totals.boxBill > 0 && (
              <li>
                <div>
                  <strong>Boxes</strong>
                  <small>{formatNumber(Number(boxQty))} sold</small>
                </div>
                <span>{formatRupees(totals.boxBill)}</span>
              </li>
            )}
          </ul>
        )}

        <fieldset className="group">
          <legend>Payment</legend>

          <div className="field">
            <label htmlFor="sale-payment">Paid or Unpaid</label>
            <Dropdown
              id="sale-payment"
              value={paymentStatus}
              options={Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={setPaymentStatus}
            />
          </div>

          {paymentStatus === 'partial' && (
            <label className="field">
              <span>Amount Paid (₹)</span>
              <input
                {...decimal}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </label>
          )}

          {paymentStatus !== 'unpaid' && (
            <>
              <div className="field">
                <label htmlFor="sale-payment-mode">Paid By</label>
                <Dropdown
                  id="sale-payment-mode"
                  value={paymentMode}
                  options={Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  onChange={setPaymentMode}
                  placeholder="Select cash, UPI or bank"
                />
              </div>

              <label className="field">
                <span>{paymentMode === 'cash' ? 'Reference' : 'UTR / Reference'}</span>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={
                    paymentMode === 'cash' ? 'e.g. received by, receipt no.' : 'e.g. UPI UTR number'
                  }
                  maxLength={100}
                />
              </label>

              <div className="field">
                <span>Payment Photo (camera or gallery)</span>
                {paymentProof ? (
                  <ul className="photo-grid">
                    <li>
                      <img src={paymentProof} alt="Payment" />
                      <button
                        type="button"
                        className="photo-remove"
                        aria-label="Remove payment photo"
                        onClick={() => setPaymentProof('')}
                      >
                        ×
                      </button>
                    </li>
                  </ul>
                ) : (
                  // Two pickers: `capture` opens the phone's camera straight away, the
                  // other its files and gallery
                  <div className="option-add-actions">
                    <label className="secondary file-pick">
                      Take Photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={chooseProof}
                      />
                    </label>
                    <label className="secondary file-pick">
                      From Gallery
                      <input type="file" accept="image/*" onChange={chooseProof} />
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          <p className="hint">
            {paymentStatus === 'unpaid'
              ? `${formatRupees(totals.amount)} to be collected`
              : balance > 0
                ? `${formatRupees(paid)} paid · ${formatRupees(balance)} to be collected`
                : `${formatRupees(paid)} paid in full`}
          </p>
        </fieldset>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Saving…' : `Save Sale — ${formatRupees(totals.amount)}`}
        </button>
      </form>
    </div>
  );
}
