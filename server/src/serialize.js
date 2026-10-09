// The shapes the API answers with. Rows are flat in the database; the app gets
// them with `_id`, and with the vendor, customer, payment, photo position and
// "who did it" grouped together.

// Who did something: { user, name }, left out when nobody was recorded
const by = (user, name) =>
  user || name ? { user: user ?? undefined, name: name ?? undefined } : undefined;

// The logged-in person (see `actor`) as the two columns of a row
export const createdBy = (who) => ({ createdById: who?.user, createdByName: who?.name });
export const addedBy = (who) => ({ addedById: who?.user, addedByName: who?.name });

// Where and when a photo was taken. The image itself is fetched separately.
// One from the gallery has no position and says so.
const photoJson = (photo) => ({
  location:
    photo.lat == null
      ? undefined
      : { lat: photo.lat, lng: photo.lng, accuracy: photo.accuracy ?? undefined },
  capturedAt: photo.capturedAt,
  fromGallery: photo.fromGallery || undefined,
});

const coopJson = (coop) => ({
  _id: coop.id,
  name: coop.name,
  birds: coop.birds,
  farm: coop.farm ?? undefined,
  fromShift: coop.fromShift,
  mortality: coop.mortality,
  sold: coop.sold,
  addedBy: by(coop.addedById, coop.addedByName),
  createdAt: coop.createdAt,
});

export const batchJson = (batch) => ({
  _id: batch.id,
  batchName: batch.batchName,
  startDate: batch.startDate,
  breed: batch.breed,
  age: batch.age,
  ageUnit: batch.ageUnit,
  numberOfBirds: batch.numberOfBirds,
  boxMortality: batch.boxMortality,
  vendor: { name: batch.vendorName, phone: batch.vendorPhone, details: batch.vendorDetails },
  shiftToFarm: batch.shiftToFarm,
  coops: batch.coops.map(coopJson),
  enteredBy: batch.enteredBy ?? undefined,
  createdBy: by(batch.createdById, batch.createdByName),
  createdAt: batch.createdAt,
  updatedAt: batch.updatedAt,
});

// The few details of a batch that a record or a set of a sale is listed with
const batchRef = ({ id, ...details }) => ({ _id: id, ...details });

// A mortality, vaccination, feed, weight, shift or feed purchase row. One loaded
// with its photos gets the first one's position and time as its own, and the
// further ones in `morePhotos`.
export function recordJson({
  id,
  batchId,
  batch,
  shiftId,
  type,
  photos,
  createdById,
  createdByName,
  ...fields
}) {
  const [first, ...more] = photos ?? [];
  return {
    _id: id,
    batch: batch ? batchRef(batch) : batchId,
    type: type ?? undefined,
    shift: shiftId ?? undefined,
    ...fields,
    ...(first && { ...photoJson(first), morePhotos: more.map(photoJson) }),
    createdBy: by(createdById, createdByName),
  };
}

export const saleJson = (sale) => ({
  _id: sale.id,
  date: sale.date,
  customer: { name: sale.customerName, phone: sale.customerPhone, address: sale.customerAddress },
  sets: sale.sets.map((set) => ({
    batch: set.batch ? batchRef(set.batch) : set.batchId,
    coopId: set.coopId,
    coopName: set.coopName,
    farm: set.farm,
    gender: set.gender ?? undefined,
    birds: set.birds,
    boxes: set.boxes,
    boxWeightEmpty: set.boxWeightEmpty,
    boxWeightGross: set.boxWeightGross,
    weightKg: set.weightKg,
    photos: set.photos.map(photoJson),
  })),
  ratePerKg: sale.ratePerKg,
  maleRate: sale.maleRate,
  femaleRate: sale.femaleRate,
  boxMode: sale.boxMode,
  boxQty: sale.boxQty,
  boxRate: sale.boxRate,
  boxReturned: sale.boxReturned,
  present: sale.present,
  notes: sale.notes,
  payment: {
    status: sale.paymentStatus,
    amountPaid: sale.amountPaid,
    mode: sale.paymentMode ?? undefined,
    reference: sale.paymentReference,
    hasProof: sale.hasProof,
  },
  birds: sale.birds,
  maleBirds: sale.maleBirds,
  femaleBirds: sale.femaleBirds,
  weightKg: sale.weightKg,
  maleWeightKg: sale.maleWeightKg,
  femaleWeightKg: sale.femaleWeightKg,
  birdBill: sale.birdBill,
  maleBill: sale.maleBill,
  femaleBill: sale.femaleBill,
  boxBill: sale.boxBill,
  amount: sale.amount,
  createdBy: by(sale.createdById, sale.createdByName),
  createdAt: sale.createdAt,
  updatedAt: sale.updatedAt,
});
