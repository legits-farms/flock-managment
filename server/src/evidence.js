// Photo evidence attached to mortality and vaccination records: a live camera
// photo plus the GPS position and time it was taken at.

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Schema fields shared by the record models. The image bytes are left out of
// normal queries and only loaded by the photo endpoint.
export const evidenceFields = {
  photo: {
    data: { type: Buffer, required: [true, 'A live photo is required'], select: false },
    contentType: { type: String, default: 'image/jpeg', select: false },
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: Number,
  },
  capturedAt: { type: Date, required: true },
};

export function parseEvidence({ photo, location, capturedAt }) {
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
    photo: { data, contentType: 'image/jpeg' },
    location: { lat, lng, accuracy: typeof accuracy === 'number' ? accuracy : undefined },
    capturedAt: takenAt,
  };
}
