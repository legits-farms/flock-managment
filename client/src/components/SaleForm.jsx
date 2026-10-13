import { useEffect, useState } from 'react';
import { createSale } from '../api.js';
import { billPdf } from '../billPdf.js';
import {
  BOX_MODE_LABELS,
  BREEDS,
  EGG_FERTILE_LABELS,
  EGG_WASH_LABELS,
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

// The form is filled in over four pages, in the order a sale happens
const STEPS = [
  {
    label: 'Customer',
    title: 'Who is buying?',
    help: 'Write the name, phone number and business name of the customer.',
  },
  {
    label: 'Birds',
    title: 'Weigh the birds',
    help: 'First weigh the empty boxes. Then add every box of birds, one by one.',
  },
  {
    label: 'Billing',
    title: 'Make the bill',
    help: 'Enter the price. Add eggs or anything else sold with the birds.',
  },
  {
    label: 'Payment',
    title: 'Take the payment',
    help: 'Check the bill, then choose how much was paid.',
  },
];

const NO_ITEM = { name: '', unit: '', qty: '', rate: '' };

const DISCOUNT_LABELS = { amount: '₹', percent: '%' };

const NO_WEIGHING ={ birds: '', boxes: '', boxWeightEmpty: '', boxWeightGross: '' };

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
  const [requirement, setRequirement] = useState({
    birds: '',
    breed: '',
    avgWeightKg: '',
    eggs: '',
    eggGrade: '',
    eggWash: '',
    eggFertile: '',
  });
  // Whether the eggs the customer wants as well are asked for
  const [showEggs, setShowEggs] = useState(false);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  // The sets weighed so far, and the one being entered
  const [sets, setSets] = useState([]);
  const [farm, setFarm] = useState(farms.length === 1 ? farms[0] : null);
  const [coopKey, setCoopKey] = useState('');
  const [batchId, setBatchId] = useState('');
  const [weighing, setWeighing] = useState(NO_WEIGHING);
  // The sets the empty boxes were weighed in: how many boxes, and their weight together
  const [emptySets, setEmptySets] = useState([]);
  // Live photos of the set being entered
  const [photos, setPhotos] = useState([]);
  // The number on the box being entered: they are usually filled in order
  const [boxNo, setBoxNo] = useState('1');

  // How many of the birds in all the sets are male and how many female
  const [maleBirds, setMaleBirds] = useState('');
  const [femaleBirds, setFemaleBirds] = useState('');
  // Which of the two was typed last: 'male' | 'female'. The other is worked out from it.
  const [sexTyped, setSexTyped] = useState(null);
  // Whether the farm, coop and batch are open to be changed once they are chosen
  const [pickingCoop, setPickingCoop] = useState(false);

  // 'kg': on the weight, at one rate. 'piece': a price for each male and each female.
  const [billBy, setBillBy] = useState('kg');
  const [ratePerKg, setRatePerKg] = useState('');
  const [maleRate, setMaleRate] = useState('');
  const [femaleRate, setFemaleRate] = useState('');
  const [boxMode, setBoxMode] = useState('own');
  const [boxQty, setBoxQty] = useState('');
  const [boxRate, setBoxRate] = useState('');
  const [boxReturned, setBoxReturned] = useState('');
  // Other things sold on the same bill, e.g. eggs, and the one being entered
  const [items, setItems] = useState([]);
  const [item, setItem] = useState(NO_ITEM);
  // Whether the fields for another item are open
  const [showItem, setShowItem] = useState(false);
  // Taken off the bill, in rupees ('amount') or as a percentage of it ('percent')
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
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

  // Said under the share buttons once the bill is copied
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
  // Whether the GST number is asked for
  const [showGst, setShowGst] = useState(false);
  // The page of the form being filled in, from 1
  const [step, setStep] = useState(1);
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
  // The empty boxes are weighed a few at a time before any are filled, so each box
  // filled weighs its share of them all empty
  const boxCount = emptySets.reduce((sum, set) => sum + set.boxes, 0);
  const emptyKg = Number(emptySets.reduce((sum, set) => sum + set.weightKg, 0).toFixed(3));
  const tareKg = Number((emptyKg / (boxCount || 1)).toFixed(3));
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
    items,
    discountType,
    discountValue,
  });
  // What the customer asked for, as numbers
  const wanted = {
    birds: Number(requirement.birds) || 0,
    avgKg: Number(requirement.avgWeightKg) || 0,
  };
  // The birds added so far are more than 50 g a bird away from the average wanted
  const avgOff =
    wanted.avgKg > 0 && totals.birds > 0 && Math.abs(totals.avgKg - wanted.avgKg) > 0.05;
  // Weight of the birds in the box being entered, and of each of them
  const boxKg = setWeightKg({ boxWeightGross: weighing.boxWeightGross, boxWeightEmpty: tareKg });
  const boxAvgKg = Number(weighing.birds) > 0 ? boxKg / Number(weighing.birds) : 0;
  const counted = totals.birds > 0 && totals.maleBirds + totals.femaleBirds === totals.birds;
  // The box being entered is more than 50 g a bird away from the average wanted
  const boxAvgOff = wanted.avgKg > 0 && boxAvgKg > 0 && Math.abs(boxAvgKg - wanted.avgKg) > 0.05;
  // Typing the males fills in the females out of the birds in the boxes, and the other way round
  const fillOther = (which, typed) => {
    const rest = totals.birds - Number(typed);
    if (typed !== '' && totals.birds > 0 && Number.isInteger(rest) && rest >= 0) {
      (which === 'male' ? setFemaleBirds : setMaleBirds)(String(rest));
    }
  };
  const countBirds = (which) => (e) => {
    (which === 'male' ? setMaleBirds : setFemaleBirds)(e.target.value);
    setSexTyped(which);
    fillOther(which, e.target.value);
  };
  // A box added or removed after the count changes what is left for the other
  useEffect(() => {
    if (sexTyped) fillOther(sexTyped, sexTyped === 'male' ? maleBirds : femaleBirds);
  }, [totals.birds]);

  // The lines of the invoice on the payment page
  const invoiceRows = [
    ...(billBy === 'kg'
      ? [
          {
            item: 'Live Birds',
            qty: totals.weightKg,
            price: Number(ratePerKg) || 0,
            unit: 'kg',
            total: totals.birdBill,
          },
        ]
      : [
          ['Male Birds', totals.maleBirds, maleRate, totals.maleBill],
          ['Female Birds', totals.femaleBirds, femaleRate, totals.femaleBill],
        ]
          .filter(([, birds]) => birds > 0)
          .map(([name, birds, rate, total]) => ({
            item: name,
            qty: birds,
            price: Number(rate) || 0,
            unit: 'pc',
            total,
          }))),
    ...(totals.boxBill > 0
      ? [
          {
            item: 'Boxes',
            qty: Number(boxQty) || 0,
            price: Number(boxRate) || 0,
            unit: 'box',
            total: totals.boxBill,
          },
        ]
      : []),
    ...items.map((added) => ({
      item: added.name,
      qty: added.qty,
      price: added.rate,
      unit: added.unit,
      total: Number((added.qty * added.rate).toFixed(2)),
    })),
  ];
  // The bill as plain text, to send on WhatsApp or through any other app. The
  // asterisks are WhatsApp's bold.
  function billText() {
    const day = new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return [
      '*Energy Eggs — Bird Sale Bill*',
      `Date: ${day}`,
      `Customer: ${customer.trim()} (${mobileNumber(phone)})`,
      business.trim() && `Business: ${business.trim()}`,
      gstin && `GST No: ${gstin}`,
      '',
      ...invoiceRows.flatMap((row) => [
        row.item,
        `   ${formatNumber(row.qty)} ${row.unit} × ${formatRupees(row.price)} = ${formatRupees(row.total)}`,
      ]),
      '',
      `Subtotal: ${formatRupees(totals.subtotal)}`,
      totals.discount > 0 && `Discount: − ${formatRupees(totals.discount)}`,
      `*Total: ${formatRupees(totals.amount)}*`,
      `Paid: ${formatRupees(paid)}`,
      balance > 0 && `To pay: ${formatRupees(balance)}`,
    ]
      .filter((line) => line !== false && line !== undefined)
      .join('\n');
  }

  // As a PDF through the phone's own share sheet, or saved to the phone when the
  // browser cannot share a file
  async function shareBill() {
    setShareNote('');
    setSharing(true);
    try {
      const file = await billPdf({
        date,
        customer: { name: customer, phone: mobileNumber(phone), address, business, gstin },
        rows: invoiceRows,
        subtotal: totals.subtotal,
        discount: totals.discount,
        discountNote: discountType === 'percent' ? `${Number(discountValue)}%` : '',
        amount: totals.amount,
        paid,
        balance,
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Bird Sale Bill' });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(link.href);
        setShareNote('✓ Bill saved on this phone as a PDF. Send it from your files.');
      }
    } catch (err) {
      // Closing the share sheet without sending is not a failure
      if (err.name !== 'AbortError') setError('Could not make the bill. Please try again.');
    } finally {
      setSharing(false);
    }
  }

  // Straight into a WhatsApp chat with the customer's number
  function whatsAppBill() {
    window.open(
      `https://wa.me/91${mobileNumber(phone)}?text=${encodeURIComponent(billText())}`,
      '_blank',
      'noopener',
    );
  }

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
    setPickingCoop(false);
  }

  function chooseBatch(id) {
    setBatchId(id);
    setPickingCoop(false);
  }

  function addEmptySet() {
    const boxes = Number(weighing.boxes);
    const weightKg = Number(weighing.boxWeightEmpty);
    if (!Number.isInteger(boxes) || boxes < 1) {
      return setError('Enter the number of empty boxes in this set.');
    }
    if (!(weightKg > 0)) return setError('Enter the weight of these empty boxes.');

    setError('');
    setEmptySets((prev) => [...prev, { boxes, weightKg }]);
    setWeighing((prev) => ({ ...prev, boxes: '', boxWeightEmpty: '' }));
  }

  function addSet() {
    const birds = Number(weighing.birds);
    if (emptySets.length === 0 && (weighing.boxes || weighing.boxWeightEmpty)) {
      return setError('Add the set of empty boxes first.');
    }
    if (!entry) return setError('Please select the farm, coop and batch the birds come from.');
    if (!Number.isInteger(birds) || birds < 1) {
      return setError('Enter the number of birds in this box.');
    }
    if (birds > available) {
      return setError(`Only ${formatNumber(available)} live birds are left in ${group.name}.`);
    }
    if (Number(weighing.boxWeightGross) < tareKg) {
      return setError('The box with birds cannot weigh less than an empty box.');
    }

    setError('');
    setSets((prev) => [
      ...prev,
      {
        batchId: entry.batch._id,
        batchName: entry.batch.batchName,
        coopId: entry.coop._id,
        coopName: entry.coop.name,
        boxNo: boxNo.trim(),
        birds,
        boxes: 1,
        boxWeightEmpty: tareKg,
        boxWeightGross: Number(weighing.boxWeightGross) || 0,
        photos,
      },
    ]);
    // The next box usually comes out of the same coop, and weighs the same empty
    setWeighing((prev) => ({ ...prev, birds: '', boxWeightGross: '' }));
    setPhotos([]);
    setBoxNo(/^\d+$/.test(boxNo.trim()) ? String(Number(boxNo) + 1) : '');
  }

  function addItem() {
    const qty = Number(item.qty);
    const rate = Number(item.rate) || 0;
    if (!item.name.trim()) return setError('Enter the name of the item.');
    if (!(qty > 0)) return setError(`Enter the quantity of ${item.name.trim()}.`);
    if (rate < 0) return setError('The rate cannot be negative.');

    setError('');
    setItems((prev) => [...prev, { name: item.name.trim(), unit: item.unit.trim(), qty, rate }]);
    setItem(NO_ITEM);
    setShowItem(false);
  }

  function addPerson() {
    if (!person.name.trim()) return;
    setPresent((prev) => [...prev, { name: person.name.trim(), phone: person.phone }]);
    setPerson({ name: '', phone: '' });
  }

  // What is wrong with a page of the form, or '' when it can be left
  function stepError(page) {
    if (page === 1) {
      if (!/^[6-9]\d{9}$/.test(mobileNumber(phone))) return 'Enter a valid 10-digit mobile number.';
      if (!business.trim()) return 'Enter the business name.';
      if (gstin && !GSTIN.test(gstin)) return 'Enter a valid 15-character GST number.';
    }
    if (page === 2) {
      if (weighing.boxes || weighing.boxWeightEmpty) {
        return 'Press “Add Empty Boxes” to keep the empty boxes you typed.';
      }
      if (weighing.birds || weighing.boxWeightGross || photos.length > 0) {
        return 'Press “Add Box” to keep the box you typed.';
      }
      if (sets.length === 0) return 'Add at least one box of birds.';
      if (totals.maleBirds + totals.femaleBirds !== totals.birds) {
        return `The males and females must add up to the ${formatNumber(totals.birds)} birds in the boxes.`;
      }
    }
    if (page === 3) {
      if (item.name || item.qty || item.rate) {
        return 'Press “Add Item” to keep the item you typed.';
      }
      if (boxMode === 'borrow' && Number(boxReturned) > Number(boxQty)) {
        return 'Boxes returned cannot be more than boxes given.';
      }
    }
    if (page === 4) {
      if (discountType === 'percent' && Number(discountValue) > 100) {
        return 'The discount cannot be more than 100%.';
      }
      if (totals.discount > totals.subtotal) return 'The discount cannot be more than the bill.';
      if (paymentStatus === 'partial' && !(paid > 0 && paid < totals.amount)) {
        return 'The amount paid must be more than 0 and less than the total bill.';
      }
      if (paymentStatus !== 'unpaid' && !paymentMode) return 'Choose how it was paid: cash, UPI or bank.';
    }
    return '';
  }

  function goTo(page) {
    setError('');
    setStep(page);
    window.scrollTo(0, 0);
  }

  // Next on every page but the last, Save on that one
  async function handleSubmit(e) {
    e.preventDefault();
    const problem = stepError(step);
    if (problem) return setError(problem);
    // A name typed but not added is taken as someone who was there
    if (step === 3) addPerson();
    if (step < STEPS.length) return goTo(step + 1);

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
        items,
        discount: { type: discountType, value: Number(discountValue) || 0 },
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
        <ol className="steps">
          {STEPS.map(({ label }, i) => (
            <li
              key={label}
              className={i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}
              aria-current={i + 1 === step ? 'step' : undefined}
            >
              {/* A page already filled in can be gone back to */}
              <button type="button" disabled={i + 1 >= step || submitting} onClick={() => goTo(i + 1)}>
                <span>{i + 1 < step ? '✓' : i + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <header className="step-head">
          <p className="eyebrow">
            New Bird Sale · Step {step} of {STEPS.length}
          </p>
          <h2>{STEPS[step - 1].title}</h2>
          <p>{STEPS[step - 1].help}</p>
        </header>

        {step === 1 && (
          <>
            <label className="field">
              <span>Customer Name</span>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Name"
                required
              />
            </label>

            <label className="field">
              <span>Phone Number</span>
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
                placeholder="Shop or business name"
                maxLength={80}
                required
              />
            </label>

            <label className="field">
              <span>
                Village / Town <em>optional</em>
              </span>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Village / town"
              />
            </label>

            <label className="field">
              <span>Date of Sale</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            {/* Only a few customers have a GST number, so it stays out of the way until asked for */}
            {showGst ? (
              <label className="field">
                <span>
                  GST Number <em>optional</em>
                </span>
                <input
                  type="text"
                  autoCapitalize="characters"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.replace(/\s/g, '').toUpperCase())}
                  placeholder="15 characters"
                />
              </label>
            ) : (
              <button type="button" className="secondary" onClick={() => setShowGst(true)}>
                + Add GST Number
              </button>
            )}

            <fieldset className="group">
              <legend>What the Customer Wants</legend>
              <p className="help">Fill this if the customer told you. You can leave it empty.</p>

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

              {/* Most customers only want birds, so the eggs open when asked for */}
              {showEggs ? (
                <>
                  <div className="field-row">
                    <label className="field">
                      <span>Eggs Required</span>
                      <input {...whole} min="1" value={requirement.eggs} onChange={setRequired('eggs')} />
                    </label>
                    <label className="field">
                      <span>Grade</span>
                      <input
                        type="text"
                        maxLength={20}
                        value={requirement.eggGrade}
                        onChange={setRequired('eggGrade')}
                        placeholder="e.g. A"
                      />
                    </label>
                  </div>

                  {[
                    ['eggWash', 'Washed or unwashed?', EGG_WASH_LABELS],
                    ['eggFertile', 'Fertile or non-fertile?', EGG_FERTILE_LABELS],
                  ].map(([field, question, labels]) => (
                    <div className="field" key={field}>
                      <span>{question}</span>
                      <div className="choice" role="group" aria-label={question}>
                        {Object.entries(labels).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={requirement[field] === value}
                            className={requirement[field] === value ? 'active' : ''}
                            // Pressing the chosen one again takes the choice back
                            onClick={() =>
                              setRequirement((prev) => ({
                                ...prev,
                                [field]: prev[field] === value ? '' : value,
                              }))
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <button type="button" className="secondary" onClick={() => setShowEggs(true)}>
                  + Customer Also Wants Eggs
                </button>
              )}
            </fieldset>
          </>
        )}

        {step === 2 && (
          <>
            {/* What the customer asked for beside what is in the boxes so far, kept on
                screen so the birds can be picked to come out at the average wanted */}
            <div className="target">
              <dl>
                <div>
                  <dt>Customer Wants</dt>
                  <dd>{wanted.birds > 0 ? `${formatNumber(wanted.birds)} birds` : '— birds'}</dd>
                  <dd>avg {wanted.avgKg > 0 ? formatKg(wanted.avgKg) : '—'}</dd>
                  {requirement.breed && <dd className="breed">{requirement.breed}</dd>}
                </div>
                <div>
                  <dt>Added So Far</dt>
                  <dd>{formatNumber(totals.birds)} birds</dd>
                  <dd className={avgOff ? 'off' : ''}>
                    avg {totals.birds > 0 ? formatKg(Number(totals.avgKg.toFixed(3))) : '—'}
                  </dd>
                </div>
              </dl>
              {wanted.birds > 0 && (
                <>
                  <div
                    className={totals.birds > wanted.birds ? 'target-bar over' : 'target-bar'}
                    aria-hidden="true"
                  >
                    <span style={{ width: `${Math.min(100, (totals.birds / wanted.birds) * 100)}%` }} />
                  </div>
                  <p>
                    {totals.birds < wanted.birds
                      ? `${formatNumber(wanted.birds - totals.birds)} more birds to add`
                      : totals.birds === wanted.birds
                        ? '✓ All the birds the customer wants are added'
                        : `${formatNumber(totals.birds - wanted.birds)} birds more than the customer wants`}
                  </p>
                </>
              )}
            </div>

            <section className={boxCount > 0 ? 'stage done' : 'stage'}>
              <header>
                <span className="stage-no" aria-hidden="true">
                  {boxCount > 0 ? '✓' : 1}
                </span>
                <div>
                  <h3>Empty Boxes</h3>
                  <p>Weigh the empty boxes first. Enter how many and their weight.</p>
                </div>
              </header>

              {/* Done before any birds are loaded: the empty boxes are weighed a few at a time */}
              <div className="field-row">
                <label className="field">
                  <span>No. of Boxes</span>
                  <input {...whole} value={weighing.boxes} onChange={setWeighed('boxes')} />
                </label>
                <label className="field">
                  <span>Empty Wt (kg)</span>
                  <input
                    {...decimal}
                    value={weighing.boxWeightEmpty}
                    onChange={setWeighed('boxWeightEmpty')}
                  />
                </label>
              </div>

              <button type="button" className="secondary" onClick={addEmptySet}>
                + Add Empty Boxes
              </button>

              {emptySets.length > 0 && (
                <ul className="chips">
                  {emptySets.map((set, i) => (
                    <li key={i}>
                      <b>
                        {formatNumber(set.boxes)} {set.boxes === 1 ? 'box' : 'boxes'}
                      </b>
                      {formatKg(set.weightKg)}
                      <button
                        type="button"
                        aria-label={`Remove empty boxes set ${i + 1}`}
                        onClick={() => setEmptySets((prev) => prev.filter((_, at) => at !== i))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {boxCount > 0 && (
                <dl className="readout">
                  <div>
                    <dt>All Empty Boxes</dt>
                    <dd>
                      {formatNumber(boxCount)} · {formatKg(emptyKg)}
                    </dd>
                  </div>
                  <div>
                    <dt>One Empty Box</dt>
                    <dd>{formatKg(tareKg)}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className={sets.length > 0 ? 'stage done' : 'stage'}>
              <header>
                <span className="stage-no" aria-hidden="true">
                  {sets.length > 0 ? '✓' : 2}
                </span>
                <div>
                  <h3>Boxes of Birds</h3>
                  <p>Fill one box, weigh it, take its photo, then press Add Box.</p>
                </div>
              </header>

              {/* The coop is picked once: every box after that comes out of it until it is changed */}
              {entry && !pickingCoop ? (
                <div className="from-coop">
                  <div>
                    <small>Birds From</small>
                    <strong>
                      {group.name} · {entry.batch.batchName}
                    </strong>
                    <small>{formatNumber(available)} live birds left</small>
                  </div>
                  <button type="button" className="link" onClick={() => setPickingCoop(true)}>
                    Change
                  </button>
                </div>
              ) : (
                <>
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
                      onChange={chooseBatch}
                      placeholder={group ? 'Select batch' : 'Select coop first'}
                    />
                  </div>

                  {entry && (
                    <button type="button" className="link" onClick={() => setPickingCoop(false)}>
                      Done
                    </button>
                  )}
                </>
              )}

              <div className="field-row">
                <label className="field">
                  <span>Box No.</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={20}
                    value={boxNo}
                    onChange={(e) => setBoxNo(e.target.value)}
                    placeholder="On the box"
                  />
                </label>
                <label className="field">
                  <span>No. of Birds</span>
                  <input
                    {...whole}
                    max={entry ? available : undefined}
                    value={weighing.birds}
                    onChange={setWeighed('birds')}
                  />
                </label>
              </div>

              <label className="field">
                <span>Box Weight with Birds (kg)</span>
                <input
                  {...decimal}
                  value={weighing.boxWeightGross}
                  onChange={setWeighed('boxWeightGross')}
                />
              </label>

              <dl className="readout">
                <div>
                  <dt>Birds in this Box</dt>
                  <dd>{formatKg(boxKg)}</dd>
                </div>
                <div>
                  <dt>Each Bird</dt>
                  <dd className={boxAvgOff ? 'off' : ''}>
                    {boxAvgKg > 0 ? formatKg(Number(boxAvgKg.toFixed(3))) : '—'}
                  </dd>
                </div>
              </dl>

              <div className="field">
                <span>Photo of this Box</span>
                {photosLeft > 0 ? (
                  <PhotoCapture value={photos} onChange={setPhotos} max={photosLeft} />
                ) : (
                  <p className="empty">This sale already has its {MAX_SALE_PHOTOS} photos.</p>
                )}
              </div>

              <button type="button" className="secondary add" onClick={addSet}>
                + Add Box
              </button>

              {sets.length === 0 ? (
                <p className="empty">No boxes added yet.</p>
              ) : (
                <ul className="box-list">
                  {sets.map((set, i) => (
                    <li key={i}>
                      <span className="set-no" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div>
                        <strong>
                          {formatNumber(set.birds)} birds · {formatKg(setWeightKg(set))}
                        </strong>
                        <small>
                          {set.boxNo && `Box ${set.boxNo} · `}
                          {set.coopName} · {set.batchName}
                          {set.photos.length > 0 &&
                            ` · ${set.photos.length} ${set.photos.length === 1 ? 'photo' : 'photos'}`}
                        </small>
                      </div>
                      <em>{formatKg(Number((setWeightKg(set) / set.birds).toFixed(3)))} each</em>
                      <button
                        type="button"
                        aria-label={`Remove box ${i + 1}`}
                        onClick={() => setSets((prev) => prev.filter((_, at) => at !== i))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {sets.length > 0 && (
                <dl className="tally">
                  <div>
                    <dt>Boxes</dt>
                    <dd>{formatNumber(sets.length)}</dd>
                  </div>
                  <div>
                    <dt>Birds</dt>
                    <dd>{formatNumber(totals.birds)}</dd>
                  </div>
                  <div>
                    <dt>Weight</dt>
                    <dd>{formatKg(totals.weightKg)}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className={counted ? 'stage done' : 'stage'}>
              <header>
                <span className="stage-no" aria-hidden="true">
                  {counted ? '✓' : 3}
                </span>
                <div>
                  <h3>Males and Females</h3>
                  <p>Enter how many birds are male. The females are worked out for you.</p>
                </div>
              </header>

              <div className="field-row">
                <label className="field">
                  <span>Males</span>
                  <input {...whole} value={maleBirds} onChange={countBirds('male')} />
                </label>
                <label className="field">
                  <span>Females</span>
                  <input {...whole} value={femaleBirds} onChange={countBirds('female')} />
                </label>
              </div>
              {totals.birds > 0 && (
                <p className={counted ? 'hint ok' : 'hint'}>
                  {counted
                    ? `✓ All ${formatNumber(totals.birds)} birds counted`
                    : `${formatNumber(totals.maleBirds + totals.femaleBirds)} of the ${formatNumber(
                        totals.birds,
                      )} birds counted`}
                </p>
              )}
            </section>
          </>
        )}

        {step === 3 && (
          <>
            <div className="field">
              <span>How is the price counted?</span>
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
                <span>Whose boxes did the birds leave in?</span>
                <div className="choice stack" role="group" aria-label="Whose boxes">
                  {Object.entries(BOX_MODE_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={boxMode === value}
                      className={boxMode === value ? 'active' : ''}
                      onClick={() => setBoxMode(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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

            {/* Few sales have anything but birds on the bill, so the fields only open when asked for */}
            {!showItem && items.length === 0 ? (
              <button type="button" className="secondary" onClick={() => setShowItem(true)}>
                + Add Other Item (eggs, etc.)
              </button>
            ) : (
              <fieldset className="group">
                <legend>Other Items</legend>

                {showItem ? (
                  <>
                    <div className="field-row">
                      <label className="field">
                        <span>Item</span>
                        <input
                          type="text"
                          maxLength={60}
                          value={item.name}
                          onChange={(e) => setItem((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Eggs"
                        />
                      </label>
                      <label className="field">
                        <span>Unit</span>
                        <input
                          type="text"
                          maxLength={12}
                          value={item.unit}
                          onChange={(e) => setItem((prev) => ({ ...prev, unit: e.target.value }))}
                          placeholder="e.g. tray, pc, kg"
                        />
                      </label>
                    </div>

                    <div className="field-row">
                      <label className="field">
                        <span>Quantity</span>
                        <input
                          {...decimal}
                          value={item.qty}
                          onChange={(e) => setItem((prev) => ({ ...prev, qty: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Rate (₹)</span>
                        <input
                          {...decimal}
                          value={item.rate}
                          onChange={(e) => setItem((prev) => ({ ...prev, rate: e.target.value }))}
                        />
                      </label>
                    </div>

                    <div className="option-add-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setItem(NO_ITEM);
                          setShowItem(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button type="button" className="primary" onClick={addItem}>
                        Add Item
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="secondary" onClick={() => setShowItem(true)}>
                    + Add Another Item
                  </button>
                )}

                {items.length > 0 && (
                  <ul className="recent-list">
                    {items.map((added, i) => (
                      <li key={i}>
                        <div>
                          <strong>{added.name}</strong>
                          <small>
                            {formatNumber(added.qty)} × {formatRupees(added.rate)} ={' '}
                            {formatRupees(added.qty * added.rate)}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="link"
                          onClick={() => setItems((prev) => prev.filter((_, at) => at !== i))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            )}

            <fieldset className="group">
              <legend>Present at Sale</legend>
              <p className="help">Who was there when the birds were weighed? You can leave this empty.</p>

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

            <dl className="batch-stats four">
              <div>
                <dt>Total Birds</dt>
                <dd>{formatNumber(totals.birds)}</dd>
              </div>
              <div>
                <dt>Total Weight</dt>
                <dd>{formatKg(totals.weightKg)}</dd>
              </div>
              <div>
                <dt>Avg Weight</dt>
                <dd>{totals.birds > 0 ? formatKg(Number(totals.avgKg.toFixed(3))) : '—'}</dd>
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
                {items.map((added, i) => (
                  <li key={i}>
                    <div>
                      <strong>{added.name}</strong>
                      <small>
                        {formatNumber(added.qty)} × {formatRupees(added.rate)}
                      </small>
                    </div>
                    <span>{formatRupees(added.qty * added.rate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <div className="invoice">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Total Kg / Qty</th>
                    <th>Price</th>
                    <th>Unit</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.item}</td>
                      <td>{formatNumber(row.qty)}</td>
                      <td>{formatRupees(row.price)}</td>
                      <td>{row.unit}</td>
                      <td>{formatRupees(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan="4">Subtotal</th>
                    <td>{formatRupees(totals.subtotal)}</td>
                  </tr>
                  {totals.discount > 0 && (
                    <tr>
                      <th colSpan="4">
                        Discount{discountType === 'percent' && ` (${Number(discountValue)}%)`}
                      </th>
                      <td>− {formatRupees(totals.discount)}</td>
                    </tr>
                  )}
                  <tr className="final">
                    <th colSpan="4">Final Total</th>
                    <td>{formatRupees(totals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="option-add-actions">
              <button type="button" className="secondary" disabled={sharing} onClick={shareBill}>
                {sharing ? 'Making PDF…' : 'Share Bill (PDF)'}
              </button>
              <button type="button" className="secondary" onClick={whatsAppBill}>
                WhatsApp Text
              </button>
            </div>
            {shareNote && <p className="hint ok">{shareNote}</p>}

            <div className="field">
              <span>Discount</span>
              <div className="input-group">
                <input
                  {...decimal}
                  max={discountType === 'percent' ? '100' : undefined}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  aria-label={discountType === 'percent' ? 'Discount in percent' : 'Discount in rupees'}
                />
                <div className="choice" role="group" aria-label="Discount in rupees or percent">
                  {Object.entries(DISCOUNT_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={discountType === value}
                      className={discountType === value ? 'active' : ''}
                      onClick={() => setDiscountType(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <fieldset className="group">
              <legend>Payment</legend>

              <div className="field">
                <span>How much was paid?</span>
                <div className="choice" role="group" aria-label="Paid or unpaid">
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={paymentStatus === value}
                      className={paymentStatus === value ? 'active' : ''}
                      onClick={() => setPaymentStatus(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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
                    <span>How was it paid?</span>
                    <div className="choice" role="group" aria-label="Paid by cash, UPI or bank">
                      {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={paymentMode === value}
                          className={paymentMode === value ? 'active' : ''}
                          onClick={() => setPaymentMode(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
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

            </fieldset>

            {/* What is paid and what is still owed, large enough to read at a glance */}
            <dl className={balance > 0 ? 'pay-summary due' : 'pay-summary'}>
              <div>
                <dt>Paid</dt>
                <dd>{formatRupees(paid)}</dd>
              </div>
              <div>
                <dt>{balance > 0 ? 'Still to Collect' : 'Nothing to Collect'}</dt>
                <dd>{formatRupees(balance)}</dd>
              </div>
            </dl>
          </>
        )}

        {/* Stays in reach at the foot of the screen, with what is wrong right above the buttons */}
        <div className="form-nav">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div>
            {step > 1 && (
              <button
                type="button"
                className="secondary"
                disabled={submitting}
                onClick={() => goTo(step - 1)}
              >
                ‹ Back
              </button>
            )}
            {step < STEPS.length ? (
              <button key="next" type="submit" className="primary">
                Next: {STEPS[step].label} ›
              </button>
            ) : (
              <button key="save" type="submit" className="primary" disabled={submitting}>
                {submitting ? 'Saving…' : `Save Sale — ${formatRupees(totals.amount)}`}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
