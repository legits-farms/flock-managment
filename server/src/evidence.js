// Photo evidence attached to mortality and vaccination records: one or more live
// camera photos, each with the GPS position and time it was taken at.

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
// Photos per record. Keeps a request well under the JSON body limit.
export const MAX_PHOTOS = 5;

export const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const position = {
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: Number,
};

// Schema fields shared by the record models. The first photo is required; any
// further ones are in `morePhotos`. The image bytes are left out of normal
// queries and only loaded by the photo endpoint.
export const evidenceFields = {
  photo: {
    data: { type: Buffer, required: [true, 'A live photo is required'], select: false },
    contentType: { type: String, default: 'image/jpeg', select: false },
  },
  location: position,
  capturedAt: { type: Date, required: true },
  morePhotos: [
    {
      _id: false,
      data: { type: Buffer, required: true, select: false },
      contentType: { type: String, default: 'image/jpeg', select: false },
      location: position,
      capturedAt: { type: Date, required: true },
    },
  ],
};

function parsePhoto({ photo, location, capturedAt } = {}) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(
    typeof photo === 'string' ? photo : ''
  );
  if (!match) throw badRequest('A live photo is required');

  const data = Buffer.from(match[1], 'base64');
  if (data.length > MAX_PHOTO_BYTES) throw badRequest('Photo is too large');

  const { lat, lng, accuracy } = location ?? {};
  const validPosition =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;
  if (!validPosition) throw badRequest('The photo must be geotagged with a location');

  const takenAt = new Date(capturedAt);
  if (!capturedAt || Number.isNaN(takenAt.getTime())) {
    throw badRequest('The photo must have a timestamp');
  }

  return {
    data,
    location: { lat, lng, accuracy: typeof accuracy === 'number' ? accuracy : undefined },
    capturedAt: takenAt,
  };
}

// The body carries the first photo as { photo, location, capturedAt } and any
// further ones, in the same shape, in `morePhotos`
export function parseEvidence(body) {
  const more = body.morePhotos ?? [];
  if (!Array.isArray(more) || more.length > MAX_PHOTOS - 1) {
    throw badRequest(`A record can have up to ${MAX_PHOTOS} photos`);
  }

  const { data, location, capturedAt } = parsePhoto(body);
  return {
    photo: { data, contentType: 'image/jpeg' },
    location,
    capturedAt,
    morePhotos: more.map((photo) => ({ ...parsePhoto(photo), contentType: 'image/jpeg' })),
  };
}
