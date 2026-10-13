// The shapes the API answers with. Rows are flat in the database; the app gets
// them with `_id`, and with the vendor, customer, payment, photo position and
// "who did it" grouped together.
import { coopFarm, managedFarm, sameFarm } from './scope.js';

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

// The part of a batch that is on one farm, as a batch of its own: only the coops
// there, and as many birds as were put on that farm. The birds in coops elsewhere
// are left out of the count, so the app's sums (live, to allocate) come out right.
function farmBatchJson(batch, farm) {
  const home = sameFarm(batch.shiftToFarm, farm);
  const here = batch.coops.filter((coop) => sameFarm(coopFarm(batch, coop), farm));
  const birds = (coops) => coops.reduce((sum, coop) => sum + coop.birds, 0);
  return batchJson({
    ...batch,
    coops: here,
    shiftToFarm: home ? batch.shiftToFarm : farm,
    // Birds not yet in a coop, and those dead on arrival, are on the batch's own farm
    numberOfBirds: home ? batch.numberOfBirds - (birds(batch.coops) - birds(here)) : birds(here),
    boxMortality: home ? batch.boxMortality : 0,
  });
}

// A batch as the logged-in person may see it: a security guard needs its coops to
// register mortality against, but not who the birds were bought from or entered by,
// and a manager gets what is on their farm
export const batchJsonFor = (user) => (batch) => {
  if (user?.role === 'security') {
    return {
      ...batchJson(batch),
      vendor: { name: '', phone: '', details: '' },
      enteredBy: undefined,
      createdBy: undefined,
    };
  }
  const farm = managedFarm(user);
  return farm ? farmBatchJson(batch, farm) : batchJson(batch);
};

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
  customer: {
    name: sale.customerName,
    phone: sale.customerPhone,
    address: sale.customerAddress,
    business: sale.customerBusiness,
    gstin: sale.customerGstin,
  },
  requirement: {
    birds: sale.requiredBirds ?? undefined,
    breed: sale.requiredBreed,
    avgWeightKg: sale.requiredAvgKg ?? undefined,
    eggs: sale.requiredEggs ?? undefined,
    eggGrade: sale.requiredEggGrade ?? '',
    eggWash: sale.requiredEggWash ?? '',
    eggFertile: sale.requiredEggFertile ?? '',
  },
  sets: sale.sets.map((set) => ({
    batch: set.batch ? batchRef(set.batch) : set.batchId,
    coopId: set.coopId,
    coopName: set.coopName,
    farm: set.farm,
    gender: set.gender ?? undefined,
    boxNo: set.boxNo,
    birds: set.birds,
    boxes: set.boxes,
    boxWeightEmpty: set.boxWeightEmpty,
    boxWeightGross: set.boxWeightGross,
    weightKg: set.weightKg,
    photos: set.photos.map(photoJson),
  })),
  billBy: sale.billBy,
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
  items: sale.items,
  itemBill: sale.itemBill,
  discountType: sale.discountType,
  discountValue: sale.discountValue,
  discount: sale.discount,
  amount: sale.amount,
  createdBy: by(sale.createdById, sale.createdByName),
  createdAt: sale.createdAt,
  updatedAt: sale.updatedAt,
});
