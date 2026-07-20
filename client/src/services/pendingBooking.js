const PENDING_BOOKING_KEY = "goTrainPendingBooking";

export function savePendingBooking({ sessionId, expiresAt, resumePath }) {
  if (!sessionId || !expiresAt || !resumePath) return;
  localStorage.setItem(
    PENDING_BOOKING_KEY,
    JSON.stringify({ sessionId, expiresAt, resumePath }),
  );
}

export function getPendingBooking() {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_BOOKING_KEY));
    if (
      !pending?.sessionId ||
      !pending?.resumePath ||
      new Date(pending.expiresAt).getTime() <= Date.now()
    ) {
      clearPendingBooking();
      return null;
    }
    return pending;
  } catch {
    clearPendingBooking();
    return null;
  }
}

export function clearPendingBooking(sessionId) {
  if (sessionId) {
    const pending = getPendingBookingWithoutValidation();
    if (pending?.sessionId !== sessionId) return;
  }
  localStorage.removeItem(PENDING_BOOKING_KEY);
}

function getPendingBookingWithoutValidation() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_BOOKING_KEY));
  } catch {
    return null;
  }
}
