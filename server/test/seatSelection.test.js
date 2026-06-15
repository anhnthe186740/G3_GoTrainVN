import test from "node:test";
import assert from "node:assert/strict";
import {
  HOLD_DURATION_MS,
  MAX_SEATS_PER_LEG,
  isSeatConflictError,
  validateSelectionCounts,
} from "../src/services/seatSelection.service.js";

test("seat hold business constants match the booking rules", () => {
  assert.equal(HOLD_DURATION_MS, 10 * 60 * 1000);
  assert.equal(MAX_SEATS_PER_LEG, 4);
});

test("Prisma unique and Mongo write conflicts become seat conflicts", () => {
  assert.equal(isSeatConflictError({ code: "P2002" }), true);
  assert.equal(isSeatConflictError({ code: "P2034" }), true);
  assert.equal(
    isSeatConflictError({
      message: "Transaction failed due to a write conflict or a deadlock",
    }),
    true,
  );
  assert.equal(isSeatConflictError({ code: "P2025" }), false);
});

test("draft selection requires one to four unique seats per leg", () => {
  assert.doesNotThrow(() => validateSelectionCounts(["seat-1"]));
  assert.doesNotThrow(() =>
    validateSelectionCounts(["seat-1", "seat-2"], ["seat-3", "seat-4"]),
  );
  assert.throws(() => validateSelectionCounts([]), /ít nhất một ghế/);
  assert.throws(
    () => validateSelectionCounts(["1", "2", "3", "4", "5"]),
    /tối đa 4 ghế/,
  );
  assert.throws(
    () => validateSelectionCounts(["seat-1", "seat-1"]),
    /bị trùng/,
  );
});

test("round trips require the same seat count on both legs", () => {
  assert.throws(
    () => validateSelectionCounts(["seat-1", "seat-2"], ["seat-3"]),
    /phải bằng nhau/,
  );
});
