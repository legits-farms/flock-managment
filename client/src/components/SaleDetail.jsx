import {
  BOX_MODE_LABELS,
  EGG_FERTILE_LABELS,
  EGG_WASH_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  formatKg,
  formatNumber,
  formatRupees,
  genderCounts,
} from '../flock.js';
import PhotoLink from './PhotoLink.jsx';

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const GENDER_LABELS = { male: 'Male', female: 'Female' };

// Everything saved with one sale of birds: the bill at the top, then who bought,
// what was weighed, how the bill adds up and what was paid.
export default function SaleDetail({ sale, onBack, onOpenBatch }) {
  const boxesOut = sale.boxQty - sale.boxReturned;
  // Sales made before payments were recorded count as unpaid
  const payment = sale.payment ?? { status: 'unpaid', amountPaid: 0 };
  const balance = Math.max(0, Number((sale.amount - payment.amountPaid).toFixed(2)));

  // What the customer asked for, the parts that were noted
  const asked = sale.requirement ?? {};
  const required = [
    asked.birds && `${formatNumber(asked.birds)} birds`,
    asked.breed,
    asked.avgWeightKg && `avg ${formatKg(asked.avgWeightKg)} each`,
    // Eggs asked for as well, said in one piece: "30 eggs, grade A, washed, fertile"
    [
      asked.eggs ? `${formatNumber(asked.eggs)} eggs` : (asked.eggGrade || asked.eggWash || asked.eggFertile) && 'Eggs',
      asked.eggGrade && `grade ${asked.eggGrade}`,
      EGG_WASH_LABELS[asked.eggWash]?.toLowerCase(),
      EGG_FERTILE_LABELS[asked.eggFertile]?.toLowerCase(),
    ]
      .filter(Boolean)
      .join(', '),
  ].filter(Boolean);

  // Each line of the bill: [label, how it was worked out, rupees, whether it is on the bill]
  const perKg = (weightKg, rate) => `${formatKg(weightKg)} × ${formatRupees(rate)}/kg`;
  const perPiece = (birds, rate) => `${formatNumber(birds)} × ${formatRupees(rate)}/pc`;
  // Sets without a gender are billed together; those with one, per gender
  const plain = sale.sets.filter((set) => !set.gender);
  const sum = (field) => plain.reduce((total, set) => total + set[field], 0);
  const bills = (
    sale.billBy === 'piece'
      ? [
          ['Male birds', perPiece(sale.maleBirds, sale.maleRate), sale.maleBill, sale.maleBirds],
          [
            'Female birds',
            perPiece(sale.femaleBirds, sale.femaleRate),
            sale.femaleBill,
            sale.femaleBirds,
          ],
        ]
      : [
          [
            'Birds',
            [perKg(sum('weightKg'), sale.ratePerKg), genderCounts(sale)].filter(Boolean).join(' · '),
            sale.birdBill,
            sum('birds'),
          ],
          // Only in older sales, where a set was all male or all female at its own rate
          [
            'Male birds',
            perKg(sale.maleWeightKg, sale.maleRate),
            sale.maleBill,
            sale.sets.some((set) => set.gender === 'male'),
          ],
          [
            'Female birds',
            perKg(sale.femaleWeightKg, sale.femaleRate),
            sale.femaleBill,
            sale.sets.some((set) => set.gender === 'female'),
          ],
        ]
  ).filter(([, , , shown]) => shown);

  return (
    <div className="manage">
      <button type="button" className="link back" onClick={onBack}>
        ‹ All records
      </button>

      <section className="hero">
        <span className={`pay-badge ${payment.status}`}>
          {PAYMENT_STATUS_LABELS[payment.status]}
        </span>
        <p className="hero-label">Sale · {formatDate(sale.date)}</p>
        <p className="hero-value">{formatRupees(sale.amount)}</p>
        <dl className="hero-stats">
          <div>
            <dt>Birds</dt>
            <dd>{formatNumber(sale.birds)}</dd>
          </div>
          <div>
            <dt>Weight</dt>
            <dd>{formatKg(sale.weightKg)}</dd>
          </div>
          <div>
            <dt>Avg / Bird</dt>
            <dd>{formatKg(sale.weightKg / sale.birds)}</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <h2 className="eyebrow">Customer</h2>
        <div className="sale-customer">
          <div>
            <strong>{sale.customer.name}</strong>
            {sale.customer.business && <small>{sale.customer.business}</small>}
            {sale.customer.gstin && <small>GST {sale.customer.gstin}</small>}
            <small>{sale.customer.phone}</small>
            {sale.customer.address && <small>{sale.customer.address}</small>}
          </div>
          <a className="photo-link" href={`tel:${sale.customer.phone}`}>
            Call
          </a>
        </div>
      </section>

      {required.length > 0 && (
        <section className="card">
          <h2 className="eyebrow">Customer's Requirement</h2>
          <p>{required.join(' · ')}</p>
        </section>
      )}

      <section className="card">
        <h2 className="eyebrow">
          Birds Weighed ({formatNumber(sale.sets.length)} {sale.sets.length === 1 ? 'set' : 'sets'})
        </h2>
        <ol className="sale-sets">
          {sale.sets.map((set, i) => (
            <li key={i}>
              <span className="set-no" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <strong>
                  {set.gender && `${GENDER_LABELS[set.gender]} · `}
                  {formatNumber(set.birds)} birds · {formatKg(set.weightKg)}
                </strong>
                <small>
                  {set.boxNo && `Box ${set.boxNo} · `}
                  {set.coopName} ·{' '}
                  {set.batch ? (
                    <button
                      type="button"
                      className="link inline"
                      onClick={() => onOpenBatch(set.batch._id)}
                    >
                      {set.batch.batchName}
                    </button>
                  ) : (
                    'Deleted batch'
                  )}
                </small>
                <small>
                  Avg {formatKg(set.weightKg / set.birds)} per bird
                  {set.boxes > 0 &&
                    ` · ${formatNumber(set.boxes)} ${set.boxes === 1 ? 'box' : 'boxes'}`}
                </small>
              </div>
              {set.photos?.length > 0 && (
                <PhotoLink url={`/sales/${sale._id}/sets/${i}/photo`} count={set.photos.length} />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2 className="eyebrow">Bill</h2>
        <ul className="bill">
          {bills.map(([label, detail, bill]) => (
            <li key={label}>
              <span>
                {label}
                <small>{detail}</small>
              </span>
              <b>{formatRupees(bill)}</b>
            </li>
          ))}
          {sale.boxMode === 'buy' && (
            <li>
              <span>
                Boxes
                <small>
                  {formatNumber(sale.boxQty)} × {formatRupees(sale.boxRate)}
                </small>
              </span>
              <b>{formatRupees(sale.boxBill)}</b>
            </li>
          )}
          {(sale.items ?? []).map((item, i) => (
            <li key={i}>
              <span>
                {item.name}
                <small>
                  {formatNumber(item.qty)} {item.unit} × {formatRupees(item.rate)}
                </small>
              </span>
              <b>{formatRupees(item.amount)}</b>
            </li>
          ))}
          {sale.discount > 0 && (
            <li>
              <span>
                Discount
                {sale.discountType === 'percent' && <small>{sale.discountValue}%</small>}
              </span>
              <b>− {formatRupees(sale.discount)}</b>
            </li>
          )}
          <li className="total">
            <span>Total Bill</span>
            <b>{formatRupees(sale.amount)}</b>
          </li>
          <li className="paid">
            <span>
              Paid
              {payment.status !== 'unpaid' && (
                <small>
                  {PAYMENT_MODE_LABELS[payment.mode]}
                  {payment.reference && ` · Ref: ${payment.reference}`}
                </small>
              )}
            </span>
            <b>{formatRupees(payment.amountPaid)}</b>
          </li>
          <li className={balance > 0 ? 'due' : ''}>
            <span>To Be Collected</span>
            <b>{formatRupees(balance)}</b>
          </li>
        </ul>
        {payment.hasProof && (
          <div className="bill-proof">
            <span>Payment photo</span>
            <PhotoLink url={`/sales/${sale._id}/payment/photo`} />
          </div>
        )}
      </section>

      {sale.boxMode === 'borrow' && (
        <section className="card">
          <h2 className="eyebrow">Boxes Borrowed</h2>
          <dl className="batch-stats">
            <div>
              <dt>Given</dt>
              <dd>{formatNumber(sale.boxQty)}</dd>
            </div>
            <div>
              <dt>Returned</dt>
              <dd>{formatNumber(sale.boxReturned)}</dd>
            </div>
            <div>
              <dt>To Return</dt>
              <dd className={boxesOut > 0 ? 'pending' : ''}>{formatNumber(boxesOut)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="card">
        <h2 className="eyebrow">Details</h2>
        <dl className="batch-details detail">
          {sale.boxMode !== 'borrow' && (
            <div>
              <dt>Boxes</dt>
              <dd>{BOX_MODE_LABELS[sale.boxMode]}</dd>
            </div>
          )}
          {sale.present.length > 0 && (
            <div>
              <dt>Present at Sale</dt>
              <dd>
                {sale.present
                  .map((person) => (person.phone ? `${person.name} (${person.phone})` : person.name))
                  .join(', ')}
              </dd>
            </div>
          )}
          {sale.notes && (
            <div>
              <dt>Notes</dt>
              <dd>{sale.notes}</dd>
            </div>
          )}
          <div>
            <dt>Entered By</dt>
            <dd>{sale.createdBy?.name ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Entered On</dt>
            <dd>{formatDateTime(sale.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
