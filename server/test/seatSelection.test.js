import test from "node:test";
import assert from "node:assert/strict";
import {
  HOLD_DURATION_MS,
  MAX_SEATS_PER_LEG,
  isSeatConflictError,
  validateSelectionCounts,
  isSegmentConflict,
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

test("isSegmentConflict detects overlapping and non-overlapping segments", () => {
  // Test case 1: no bookings on the seat
  assert.equal(isSegmentConflict(0, 2, []), false);

  // Test case 2: non-overlapping chặng (người trước đi HN->Vinh [0->2], người sau đi Vinh->ĐN [2->3])
  assert.equal(
    isSegmentConflict(2, 3, [{ fromStopOrder: 0, toStopOrder: 2 }]),
    false,
  );

  // Test case 3: overlapping chặng (người trước đi HN->Vinh [0->2], người sau đi HN->ĐN [0->3])
  assert.equal(
    isSegmentConflict(0, 3, [{ fromStopOrder: 0, toStopOrder: 2 }]),
    true,
  );

  // Test case 4: overlapping chặng (người trước đi Vinh->ĐN [2->3], người sau đi HN->SG [0->4])
  assert.equal(
    isSegmentConflict(0, 4, [{ fromStopOrder: 2, toStopOrder: 3 }]),
    true,
  );

  // Test case 5: ga đầu của người sau trùng ga cuối người trước (không overlap, vd 2->4 và 0->2)
  assert.equal(
    isSegmentConflict(2, 4, [{ fromStopOrder: 0, toStopOrder: 2 }]),
    false,
  );

  // Test case 6: ga cuối của người sau trùng ga đầu người trước (không overlap, vd 0->2 và 2->4)
  assert.equal(
    isSegmentConflict(0, 2, [{ fromStopOrder: 2, toStopOrder: 4 }]),
    false,
  );
});
