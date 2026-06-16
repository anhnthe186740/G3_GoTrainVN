import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCarriageConfigs,
  buildDefaultCarriageTypes,
  buildSeats,
} from "../src/utils/trainInventory.js";

test("default carriage layout covers the configured train length", () => {
  assert.deepEqual(buildDefaultCarriageTypes(6), [
    "NORMAL_SEAT",
    "AC_SEAT",
    "SLEEPER_6",
    "SLEEPER_4",
    "NORMAL_SEAT",
    "AC_SEAT",
  ]);
});

test("carriage configs calculate capacity from carriage type", () => {
  assert.deepEqual(
    buildCarriageConfigs(["NORMAL_SEAT", "AC_SEAT"]).map((item) => ({
      carriageNumber: item.carriageNumber,
      totalSeats: item.totalSeats,
    })),
    [
      { carriageNumber: 1, totalSeats: 40 },
      { carriageNumber: 2, totalSeats: 28 },
    ],
  );
});

test("seat generator creates unique seats for sleeper carriages", () => {
  const seats = buildSeats("carriage-1", "SLEEPER_6");

  assert.equal(seats.length, 24);
  assert.equal(new Set(seats.map((seat) => seat.seatNumber)).size, 24);
});
