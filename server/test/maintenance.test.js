import test from "node:test";
import assert from "node:assert/strict";
import {
  isTrainRunning,
  shiftStopTimes,
  shouldTriggerDelayWarning,
} from "../src/utils/maintenanceHelper.js";

test("isTrainRunning detects active running schedules correctly", () => {
  const now = new Date("2026-06-21T12:00:00Z");

  // Case 1: Train has schedule that has not started yet
  const futureSchedule = [
    {
      departureTime: new Date("2026-06-21T13:00:00Z"),
      arrivalTime: new Date("2026-06-21T18:00:00Z"),
    },
  ];
  assert.equal(isTrainRunning(futureSchedule, now), false);

  // Case 2: Train has completed its schedule
  const pastSchedule = [
    {
      departureTime: new Date("2026-06-21T06:00:00Z"),
      arrivalTime: new Date("2026-06-21T11:00:00Z"),
    },
  ];
  assert.equal(isTrainRunning(pastSchedule, now), false);

  // Case 3: Train is currently running on the rails (BR-30)
  const currentSchedule = [
    {
      departureTime: new Date("2026-06-21T10:00:00Z"),
      arrivalTime: new Date("2026-06-21T15:00:00Z"),
    },
  ];
  assert.equal(isTrainRunning(currentSchedule, now), true);
});

test("shiftStopTimes shifts subsequent stops by delayMinutes correctly", () => {
  const stops = [
    {
      stationId: "station-1",
      arrivalTime: new Date("2026-06-21T10:30:00Z"),
      departureTime: new Date("2026-06-21T10:45:00Z"),
    },
    {
      stationId: "station-2",
      arrivalTime: new Date("2026-06-21T12:00:00Z"),
      departureTime: null,
    },
  ];

  const delayMinutes = 15;
  const shifted = shiftStopTimes(stops, delayMinutes);

  assert.equal(
    shifted[0].arrivalTime.toISOString(),
    new Date("2026-06-21T10:45:00Z").toISOString(),
  );
  assert.equal(
    shifted[0].departureTime.toISOString(),
    new Date("2026-06-21T11:00:00Z").toISOString(),
  );
  assert.equal(
    shifted[1].arrivalTime.toISOString(),
    new Date("2026-06-21T12:15:00Z").toISOString(),
  );
  assert.equal(shifted[1].departureTime, null);
});

test("shouldTriggerDelayWarning flags delay greater than 10 minutes (BR-32)", () => {
  assert.equal(shouldTriggerDelayWarning(5), false);
  assert.equal(shouldTriggerDelayWarning(10), false);
  assert.equal(shouldTriggerDelayWarning(11), true);
  assert.equal(shouldTriggerDelayWarning(20), true);
});
