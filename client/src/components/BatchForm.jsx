import { useState } from 'react';
import { addFarm, createBatch } from '../api.js';
import { BREEDS } from '../flock.js';
import Dropdown from './Dropdown.jsx';
import OptionSelect from './OptionSelect.jsx';

const BREED_OPTIONS = BREEDS.map((breed) => ({ value: breed, label: breed }));

const AGE_UNITS = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

// YYYY-MM-DD in local time, the format <input type="date"> expects
const today = () => new Date().toLocaleDateString('en-CA');

const emptyForm = () => ({
  batchName: '',
  startDate: today(),
  breed: '',
  age: '',
  ageUnit: 'days',
  numberOfBirds: '',
  boxMortality: '',
  vendorName: '',
  vendorPhone: '',
  vendorDetails: '',
  shiftToFarm: '',
  enteredBy: '',
});

export default function BatchForm({ farms, onOptions, onRegistered }) {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setValue = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const birds = Number(form.numberOfBirds) || 0;
  const mortality = Number(form.boxMortality) || 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.breed) {
      setError('Please select a breed.');
      return;
    }
    if (!form.shiftToFarm) {
      setError('Please select a farm.');
      return;
    }
    if (mortality > birds) {
      setError('Mortality cannot be more than the number of birds.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const batch = await createBatch({
        batchName: form.batchName,
        startDate: form.startDate,
        breed: form.breed,
        age: Number(form.age),
        ageUnit: form.ageUnit,
        numberOfBirds: birds,
        boxMortality: mortality,
        vendor: {
          name: form.vendorName,
          phone: form.vendorPhone,
          details: form.vendorDetails,
        },
        shiftToFarm: form.shiftToFarm,
        enteredBy: form.enteredBy,
      });
      setForm(emptyForm());
      onRegistered(batch);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Enter Batch</h2>

      <label className="field">
        <span>Batch Name</span>
        <input
          type="text"
          value={form.batchName}
          onChange={set('batchName')}
          placeholder="e.g. Batch 12"
          required
        />
      </label>

      <label className="field">
        <span>Batch Start Date</span>
        <input type="date" value={form.startDate} onChange={set('startDate')} required />
      </label>

      <div className="field">
        <label htmlFor="breed">Breed</label>
        <Dropdown
          id="breed"
          value={form.breed}
          options={BREED_OPTIONS}
          onChange={setValue('breed')}
          placeholder="Select breed"
        />
      </div>

      <div className="field">
        <label htmlFor="age">Age of the Birds</label>
        <div className="input-group">
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min="0"
            value={form.age}
            onChange={set('age')}
            placeholder="0"
            required
          />
          <Dropdown
            value={form.ageUnit}
            options={AGE_UNITS}
            onChange={setValue('ageUnit')}
            ariaLabel="Age unit"
          />
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Number of Birds</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={form.numberOfBirds}
            onChange={set('numberOfBirds')}
            placeholder="0"
            required
          />
        </label>

        <label className="field">
          <span>Box Mortality</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={form.boxMortality}
            onChange={set('boxMortality')}
            placeholder="0"
          />
        </label>
      </div>

      {birds > 0 && mortality <= birds && (
        <p className="hint">Live birds placed: {(birds - mortality).toLocaleString('en-IN')}</p>
      )}

      <fieldset className="group">
        <legend>Vendor Details</legend>

        <label className="field">
          <span>Vendor Name</span>
          <input type="text" value={form.vendorName} onChange={set('vendorName')} required />
        </label>

        <label className="field">
          <span>Vendor Phone</span>
          <input
            type="tel"
            inputMode="tel"
            value={form.vendorPhone}
            onChange={set('vendorPhone')}
            placeholder="Optional"
          />
        </label>

        <label className="field">
          <span>Other Details</span>
          <textarea
            rows="2"
            value={form.vendorDetails}
            onChange={set('vendorDetails')}
            placeholder="Address, invoice no., notes (optional)"
          />
        </label>
      </fieldset>

      <div className="field">
        <label htmlFor="farm">Farm</label>
        <OptionSelect
          id="farm"
          value={form.shiftToFarm}
          names={farms}
          onChange={setValue('shiftToFarm')}
          placeholder="Select farm"
          addLabel="Add a farm"
          onAdd={async (name) => onOptions(await addFarm(name))}
        />
      </div>

      <label className="field">
        <span>Entered By</span>
        <input
          type="text"
          value={form.enteredBy}
          onChange={set('enteredBy')}
          placeholder="Name of the person entering this batch"
          maxLength="40"
          required
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Registering…' : 'Register'}
      </button>
    </form>
  );
}
