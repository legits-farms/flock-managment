// Photo evidence attached to mortality and vaccination records: one or more live
// camera photos, each with the GPS position and time it was taken at.

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
// Photos per record. Keeps a request well under the JSON body limit.
export const MAX_PHOTOS = 5;

export const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// The image out of a JPEG data URL
function photoBytes(photo) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(
    typeof photo === 'string' ? photo : ''
  );
  if (!match) throw badRequest('A live photo is required');

  const data = Buffer.from(match[1], 'base64');
  if (data.length > MAX_PHOTO_BYTES) throw badRequest('Photo is too large');
  return data;
}

// One live photo, sent as { photo, location, capturedAt }: its bytes, where and when.
// `user` is the logged-in person: an admin may instead send a picture from the
// gallery as { photo, fromGallery: true }, which has no position and is timed now.
export function parsePhoto({ photo, location, capturedAt, fromGallery } = {}, user) {
  if (fromGallery) {
    if (!user?.isAdmin) throw badRequest('Only an admin can add photos from the gallery');
    return { data: photoBytes(photo), location: {}, capturedAt: new Date(), fromGallery: true };
  }

  const data = photoBytes(photo);

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

// Parsed photos as Photo rows, in the order taken: the first is at position 0
export const photoRows = (photos) =>
  photos.map(({ data, location, capturedAt, fromGallery = false }, position) => ({
    position,
    data,
    contentType: 'image/jpeg',
    fromGallery,
    ...location,
    capturedAt,
  }));

// The body carries the first photo as { photo, location, capturedAt } and any
// further ones, in the same shape, in `morePhotos`. Resolves to their Photo rows.
// `user` is the logged-in person, see parsePhoto.
export function parseEvidence(body, user) {
  const more = body.morePhotos ?? [];
  if (!Array.isArray(more) || more.length > MAX_PHOTOS - 1) {
    throw badRequest(`A record can have up to ${MAX_PHOTOS} photos`);
  }

  return photoRows([parsePhoto(body, user), ...more.map((photo) => parsePhoto(photo, user))]);
}
