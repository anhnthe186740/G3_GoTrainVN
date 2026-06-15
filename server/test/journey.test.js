import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSchedulePoints,
  isDepartureWithinRange,
  parseVietnamDateRange,
  resolveJourneySegment,
} from "../src/utils/journey.js";

function scheduleFixture(overrides = {}) {
  return {
    id: "schedule-1",
    status: "ACTIVE",
    delayMinutes: 0,
    departureTime: "2026-06-20T01:00:00.000Z",
    arrivalTime: "2026-06-20T05:00:00.000Z",
    distance: 400,
    route: {
      distance: 400,
      startStation: { id: "station-a", stationName: "Ga A" },
      endStation: { id: "station-d", stationName: "Ga D" },
      stations: [
        {
          stationId: "station-b",
          stationName: "Ga B",
          stopOrder: 1,
          distanceFromStart: 100,
        },
        {
          stationId: "station-c",
          stationName: "Ga C",
          stopOrder: 2,
          distanceFromStart: 300,
        },
      ],
    },
    scheduleStops: [],
    ...overrides,
  };
}

test("parseVietnamDateRange creates the exact GMT+7 day", () => {
  const range = parseVietnamDateRange("2026-06-20");

  assert.equal(range.start.toISOString(), "2026-06-19T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-06-20T17:00:00.000Z");
});

test("parseVietnamDateRange rejects impossible dates", () => {
  assert.throws(
    () => parseVietnamDateRange("2026-02-30"),
    /Ngày đi không hợp lệ/,
  );
});

test("resolveJourneySegment supports boarding and alighting at intermediate stations", () => {
  const segment = resolveJourneySegment(
    scheduleFixture(),
    "station-b",
    "station-c",
  );

  assert.equal(segment.distance, 200);
  assert.equal(segment.duration, 120);
  assert.equal(segment.origin.stationName, "Ga B");
  assert.equal(segment.destination.stationName, "Ga C");
});

test("resolveJourneySegment rejects reverse direction on the same route", () => {
  const segment = resolveJourneySegment(
    scheduleFixture(),
    "station-c",
    "station-b",
  );

  assert.equal(segment, null);
});

test("recorded schedule stop times take precedence over estimates", () => {
  const schedule = scheduleFixture({
    scheduleStops: [
      {
        stationId: "station-b",
        arrivalTime: "2026-06-20T02:10:00.000Z",
        departureTime: "2026-06-20T02:15:00.000Z",
      },
    ],
  });
  const points = buildSchedulePoints(schedule);

  assert.equal(points[1].arrivalTime.toISOString(), "2026-06-20T02:10:00.000Z");
  assert.equal(
    points[1].departureTime.toISOString(),
    "2026-06-20T02:15:00.000Z",
  );
});

test("delay minutes are applied to every journey point", () => {
  const schedule = scheduleFixture({
    status: "DELAYED",
    delayMinutes: 30,
  });
  const segment = resolveJourneySegment(schedule, "station-a", "station-b");

  assert.equal(segment.departureTime.toISOString(), "2026-06-20T01:30:00.000Z");
  assert.equal(segment.arrivalTime.toISOString(), "2026-06-20T02:30:00.000Z");
});

test("departure must be inside the selected day and in the future", () => {
  const range = parseVietnamDateRange("2026-06-20");
  const segment = resolveJourneySegment(
    scheduleFixture(),
    "station-a",
    "station-b",
  );

  assert.equal(
    isDepartureWithinRange(
      segment,
      range,
      new Date("2026-06-20T00:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    isDepartureWithinRange(
      segment,
      range,
      new Date("2026-06-20T01:30:00.000Z"),
    ),
    false,
  );
});
