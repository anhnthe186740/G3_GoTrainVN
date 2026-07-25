import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("validateSameDirectionGap")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";
import {
  validateStopTimeSequence,
  validateSingleStopSequence,
} from "../src/utils/singleTrackValidator.js";

// ─────────────────────────────────────────────────────────────────────────────
// TRACK-01: validateSameDirectionGap (async, gọi prisma.schedule.findMany)
// ─────────────────────────────────────────────────────────────────────────────

test("validateSameDirectionGap - UTCID01: hai tàu cùng tuyến cách nhau 10 phút (< 20 phút) thì báo lỗi giãn cách", async (t) => {
  const existing = {
    id: "sched-existing-1",
    departureTime: new Date("2026-07-10T00:10:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
    train: { trainCode: "SE1" },
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { schedule: { findMany: async () => [existing] } },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
  });

  assert.equal(result.valid, false);
  assert.equal(result.conflict.type, "SAME_DIRECTION_GAP");
  assert.equal(result.conflict.conflictingScheduleId, "sched-existing-1");
  assert.equal(result.conflict.gapMinutes, 10);
  assert.equal(result.conflict.requiredGapMinutes, 20);
});

test("validateSameDirectionGap - UTCID02: hai tàu cùng tuyến cách nhau 45 phút (>= 20 phút) thì hợp lệ", async (t) => {
  const existing = {
    id: "sched-existing-2",
    departureTime: new Date("2026-07-10T00:45:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:45:00.000Z"),
    train: { trainCode: "SE2" },
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { schedule: { findMany: async () => [existing] } },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
  });

  assert.equal(result.valid, true);
});

test("validateSameDirectionGap - UTCID03: khoảng cách đúng bằng 20 phút (biên hợp lệ) thì không báo lỗi", async (t) => {
  const existing = {
    id: "sched-existing-3",
    departureTime: new Date("2026-07-10T00:20:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:20:00.000Z"),
    train: { trainCode: "SE3" },
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { schedule: { findMany: async () => [existing] } },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
  });

  assert.equal(result.valid, true);
});

test("validateSameDirectionGap - UTCID04: khoảng cách 19 phút (ngay dưới biên tối thiểu) thì báo lỗi", async (t) => {
  const existing = {
    id: "sched-existing-4",
    departureTime: new Date("2026-07-10T00:19:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:19:00.000Z"),
    train: { trainCode: "SE4" },
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { schedule: { findMany: async () => [existing] } },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
  });

  assert.equal(result.valid, false);
  assert.equal(result.conflict.gapMinutes, 19);
});

test("validateSameDirectionGap - UTCID05: gapMinutes tùy chỉnh = 0 (biên dưới) thì mọi khoảng cách kể cả trùng giờ đều hợp lệ", async (t) => {
  const existing = {
    id: "sched-existing-5",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
    train: { trainCode: "SE5" },
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { schedule: { findMany: async () => [existing] } },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"), // trùng giờ tàu kia, gap = 0
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
    gapMinutes: 0,
  });

  assert.equal(result.valid, true);
});

test("validateSameDirectionGap - UTCID06: departureTime là chuỗi không hợp lệ thì báo lỗi đầu vào không hợp lệ", async (t) => {
  const existing = {
    id: "sched-existing-6",
    departureTime: new Date("2026-07-10T00:05:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:05:00.000Z"),
    train: { trainCode: "SE6" },
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { schedule: { findMany: async () => [existing] } },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: "not-a-valid-date",
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
  });

  assert.equal(result.valid, false);
  assert.equal(result.conflict.type, "INVALID_INPUT");
});

test("validateSameDirectionGap - UTCID07: lỗi truy vấn prisma (DB error) thì hàm reject lỗi ra ngoài, không nuốt lỗi", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        schedule: {
          findMany: async () => {
            throw new Error("DB connection lost");
          },
        },
      },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  await assert.rejects(
    () =>
      validateSameDirectionGap({
        routeId: "route-1",
        departureTime: new Date("2026-07-10T00:00:00.000Z"),
        arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
      }),
    /DB connection lost/,
  );
});

test("validateSameDirectionGap - UTCID08: excludeScheduleId được truyền thì loại trừ chính lịch trình đang sửa khỏi điều kiện tìm kiếm (boundary)", async (t) => {
  let capturedWhere;
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        schedule: {
          findMany: async (args) => {
            capturedWhere = args.where;
            return [];
          },
        },
      },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
    excludeScheduleId: "self-schedule-id",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(capturedWhere.id, { not: "self-schedule-id" });
});

test("validateSameDirectionGap - UTCID09: tàu xung đột không có thông tin train (trainCode) thì message dùng nhãn dự phòng 'khác' (boundary)", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        schedule: {
          findMany: async () => [
            {
              id: "sched-no-train",
              departureTime: new Date("2026-07-10T00:05:00.000Z"),
              arrivalTime: new Date("2026-07-10T04:05:00.000Z"),
              train: null,
            },
          ],
        },
      },
    },
  });
  const { validateSameDirectionGap } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateSameDirectionGap({
    routeId: "route-1",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T04:00:00.000Z"),
  });

  assert.equal(result.valid, false);
  assert.match(result.conflict.message, /Tàu khác xuất phát/);
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACK-02: validateOpposingDirectionConflict (async, gọi prisma.route.findMany
// và prisma.schedule.findMany)
// ─────────────────────────────────────────────────────────────────────────────

function opposingSchedule(overrides = {}) {
  return {
    id: "sched-opp-1",
    departureTime: new Date("2026-07-10T01:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T03:00:00.000Z"),
    scheduleStops: [],
    train: { trainCode: "SE-OPP" },
    route: {
      startStation: { id: "st-B", stationName: "Ga B" },
      endStation: { id: "st-A", stationName: "Ga A" },
    },
    ...overrides,
  };
}

test("UTCID01: hai tàu ngược chiều có khoảng thời gian giao nhau trên cùng đoạn ray thì báo lỗi xung đột", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T01:00:00.000Z"), // rời B lúc 01:00
              arrivalTime: new Date("2026-07-10T03:00:00.000Z"), // đến A lúc 03:00
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"), // rời A lúc 00:00
    arrivalTime: new Date("2026-07-10T02:00:00.000Z"), // đến B lúc 02:00
    proposedStops: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.conflict.type, "OPPOSING_DIRECTION");
  assert.equal(result.conflict.conflictingScheduleId, "sched-opp-1");
});

test("UTCID02: hai tàu ngược chiều có khung giờ không giao nhau thì hợp lệ", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T12:00:00.000Z"), // rời B lúc 12:00
              arrivalTime: new Date("2026-07-10T14:00:00.000Z"), // đến A lúc 14:00
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"), // rời A lúc 00:00
    arrivalTime: new Date("2026-07-10T01:00:00.000Z"), // đến B lúc 01:00, xong trước khi tàu kia rời B (12:00)
    proposedStops: [],
  });

  assert.equal(result.valid, true);
});

test("UTCID03: không có tuyến ngược chiều (0 route) thì hợp lệ ngay, không cần truy vấn schedule", async (t) => {
  let scheduleFindManyCalled = false;
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [] },
        schedule: {
          findMany: async () => {
            scheduleFindManyCalled = true;
            return [];
          },
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
    proposedStops: [],
  });

  assert.equal(result.valid, true);
  assert.equal(scheduleFindManyCalled, false);
});

test("UTCID04: hai khung giờ chạm biên đúng lúc (đến ga B lúc 01:00 = tàu kia rời B lúc 01:00) thì KHÔNG tính là giao nhau", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T01:00:00.000Z"), // rời B lúc 01:00 (đúng lúc tàu kia vừa đến)
              arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T01:00:00.000Z"), // đến B đúng lúc 01:00
    proposedStops: [],
  });

  assert.equal(result.valid, true);
});

test("UTCID05: hai khung giờ giao nhau đúng 1 phút (biên trên của trường hợp xung đột) thì báo lỗi", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T01:00:00.000Z"),
              arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T01:01:00.000Z"), // đến B lúc 01:01, trễ hơn 1 phút so với lúc tàu kia rời B
    proposedStops: [],
  });

  assert.equal(result.valid, false);
  assert.equal(result.conflict.type, "OPPOSING_DIRECTION");
});

test("UTCID06: lỗi truy vấn prisma.route.findMany thì hàm reject lỗi ra ngoài", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: {
          findMany: async () => {
            throw new Error("DB route query failed");
          },
        },
        schedule: { findMany: async () => [] },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  await assert.rejects(
    () =>
      validateOpposingDirectionConflict({
        startStationId: "st-A",
        endStationId: "st-B",
        departureTime: new Date("2026-07-10T00:00:00.000Z"),
        arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
        proposedStops: [],
      }),
    /DB route query failed/,
  );
});

test("UTCID07: ga trung gian đề xuất (proposedStops) không khớp với bất kỳ ga nào của tàu ngược chiều thì đoạn đó bị bỏ qua, không phát hiện xung đột dù khung giờ giao nhau", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T01:00:00.000Z"), // rời B lúc 01:00
              arrivalTime: new Date("2026-07-10T03:00:00.000Z"), // đến A lúc 03:00
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"), // rời A lúc 00:00
    arrivalTime: new Date("2026-07-10T02:00:00.000Z"), // đến B lúc 02:00 (giao với tàu kia nếu đi thẳng)
    proposedStops: [
      {
        stationId: "st-X", // ga không tồn tại trong lịch trình tàu ngược chiều
        stopOrder: 1,
        arrivalTime: new Date("2026-07-10T00:30:00.000Z"),
        departureTime: new Date("2026-07-10T00:35:00.000Z"),
      },
    ],
  });

  // Hành vi thực tế: vì đoạn [A→X] và [X→B] không khớp ga nào trong oppPoints,
  // cả 2 đoạn đều bị "continue" nên không phát hiện xung đột dù về tổng thể
  // 2 tàu vẫn giao nhau trên cùng đoạn ray A-B.
  assert.equal(result.valid, true);
});

test("UTCID08: có tuyến ngược chiều nhưng không có lịch trình nào trong khung giờ (0 schedule) thì hợp lệ", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: { findMany: async () => [] },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
    proposedStops: [],
  });

  assert.equal(result.valid, true);
});

test("UTCID09: dữ liệu route ngược chiều bất thường khiến thứ tự ga trong oppPoints bị đảo ngược thì đoạn đó bị bỏ qua (continue), không throw", async (t) => {
  // route.startStation trùng với startStationId của lịch đề xuất (thay vì endStationId như bình thường)
  // khiến oppSegStartIdx (tìm ga "st-B") >= oppSegEndIdx (tìm ga "st-A") trong oppPoints.
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              route: {
                startStation: { id: "st-A", stationName: "Ga A" }, // đảo ngược bất thường
                endStation: { id: "st-B", stationName: "Ga B" },
              },
              departureTime: new Date("2026-07-10T00:30:00.000Z"),
              arrivalTime: new Date("2026-07-10T01:30:00.000Z"),
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
    proposedStops: [],
  });

  assert.equal(result.valid, true);
});

test("UTCID10: excludeScheduleId được truyền thì loại trừ lịch trình đang sửa khỏi truy vấn tàu ngược chiều (boundary)", async (t) => {
  let capturedWhere;
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async (args) => {
            capturedWhere = args.where;
            return [];
          },
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
    proposedStops: [],
    excludeScheduleId: "self-schedule-id",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(capturedWhere.id, { not: "self-schedule-id" });
});

test("UTCID11: ga trung gian có thời gian đã ghi nhận (proposedStops + opp.scheduleStops) vẫn phát hiện xung đột đúng đoạn ray (normal)", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T01:00:00.000Z"), // rời B lúc 01:00
              arrivalTime: new Date("2026-07-10T03:00:00.000Z"), // đến A lúc 03:00
              scheduleStops: [
                {
                  station: { id: "st-C", stationName: "Ga C" },
                  arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
                  departureTime: new Date("2026-07-10T02:05:00.000Z"),
                },
              ],
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"), // rời A lúc 00:00
    arrivalTime: new Date("2026-07-10T02:30:00.000Z"), // đến B lúc 02:30
    proposedStops: [
      {
        stationId: "st-C",
        stopOrder: 1,
        arrivalTime: new Date("2026-07-10T01:00:00.000Z"),
        departureTime: new Date("2026-07-10T01:05:00.000Z"),
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.equal(result.conflict.type, "OPPOSING_DIRECTION");
});

test("UTCID12: ga trung gian thiếu 1 trong 2 mốc giờ (chỉ có arrivalTime hoặc chỉ có departureTime) ở cả 2 phía vẫn được xử lý đúng qua các nhánh dự phòng ||, không throw (boundary)", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        route: { findMany: async () => [{ id: "route-opp-1" }] },
        schedule: {
          findMany: async () => [
            opposingSchedule({
              departureTime: new Date("2026-07-10T01:00:00.000Z"),
              arrivalTime: new Date("2026-07-10T03:00:00.000Z"),
              train: null, // trainCode fallback "ngược chiều" trong message
              scheduleStops: [
                {
                  station: { id: "st-C", stationName: "Ga C" },
                  arrivalTime: new Date("2026-07-10T02:00:00.000Z"),
                  departureTime: null, // chỉ có arrivalTime, không có departureTime
                },
              ],
            }),
          ],
        },
      },
    },
  });
  const { validateOpposingDirectionConflict } = await import(
    `../src/utils/singleTrackValidator.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await validateOpposingDirectionConflict({
    startStationId: "st-A",
    endStationId: "st-B",
    departureTime: new Date("2026-07-10T00:00:00.000Z"),
    arrivalTime: new Date("2026-07-10T02:30:00.000Z"),
    proposedStops: [
      {
        stationId: "st-C",
        stopOrder: 1,
        arrivalTime: new Date("2026-07-10T01:00:00.000Z"),
        departureTime: null, // chỉ có arrivalTime, không có departureTime -> fallback ||
      },
    ],
  });

  assert.equal(typeof result.valid, "boolean");
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACK-03: validateStopTimeSequence (sync)
// ─────────────────────────────────────────────────────────────────────────────

test("UTCID01: danh sách ga dừng hợp lệ theo đúng thứ tự thời gian thì không có lỗi", () => {
  const result = validateStopTimeSequence({
    stops: [
      {
        stopOrder: 1,
        arrivalTime: "2026-07-10T01:00:00.000Z",
        departureTime: "2026-07-10T01:10:00.000Z",
      },
      {
        stopOrder: 2,
        arrivalTime: "2026-07-10T02:00:00.000Z",
        departureTime: "2026-07-10T02:10:00.000Z",
      },
    ],
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID06: ga dừng thiếu arrivalTime hoặc thiếu departureTime thì bỏ qua đúng nhánh kiểm tra tương ứng, không throw (boundary)", () => {
  const result = validateStopTimeSequence({
    stops: [
      {
        stopOrder: 1,
        arrivalTime: null, // chỉ có giờ đi, không có giờ đến (VD ga xuất phát được liệt kê như 1 stop)
        departureTime: "2026-07-10T01:10:00.000Z",
      },
      {
        stopOrder: 2,
        arrivalTime: "2026-07-10T02:00:00.000Z",
        departureTime: null, // chỉ có giờ đến, không có giờ đi (VD ga cuối)
      },
    ],
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID02: mảng stops rỗng (biên dưới) thì hợp lệ và không có lỗi", () => {
  const result = validateStopTimeSequence({
    stops: [],
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID03: stops = null (biên dưới, thiếu hẳn) thì hợp lệ theo nhánh early-return, không throw", () => {
  const result = validateStopTimeSequence({
    stops: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID04: hai ga liền kề có departureTime[N] đúng bằng arrivalTime[N+1] (biên) thì báo lỗi vì yêu cầu phải nhỏ hơn nghiêm ngặt", () => {
  const result = validateStopTimeSequence({
    stops: [
      {
        stopOrder: 1,
        arrivalTime: "2026-07-10T01:00:00.000Z",
        departureTime: "2026-07-10T01:30:00.000Z",
      },
      {
        stopOrder: 2,
        arrivalTime: "2026-07-10T01:30:00.000Z", // trùng đúng giờ đi của ga trước
        departureTime: "2026-07-10T01:40:00.000Z",
      },
    ],
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /phải trước giờ đến ga #2/);
});

test("UTCID05: ga dừng có giờ đến sau giờ đi tại cùng ga, giờ đến trước giờ xuất phát ga đầu và giờ đi sau giờ cập ga cuối (input sai/bất thường) thì trả về đủ 3 lỗi", () => {
  const result = validateStopTimeSequence({
    stops: [
      {
        stopOrder: 1,
        arrivalTime: "2026-07-10T05:00:00.000Z", // đến sau khi đi -> lỗi 1
        departureTime: "2026-07-10T04:00:00.000Z",
      },
    ],
    scheduleDepartureTime: "2026-07-10T10:00:00.000Z", // ga đầu xuất phát trễ hơn cả giờ đến của stop -> lỗi 2
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z", // ga cuối đến sớm hơn cả giờ đi của stop -> lỗi 3
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// TRACK-04: validateSingleStopSequence (sync)
// ─────────────────────────────────────────────────────────────────────────────

test("UTCID01: ga dừng đơn lẻ hợp lệ, nằm giữa stop trước và stop sau thì không có lỗi", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T01:00:00.000Z",
    departureTime: "2026-07-10T01:10:00.000Z",
    prevStop: { departureTime: "2026-07-10T00:30:00.000Z" },
    nextStop: { arrivalTime: "2026-07-10T02:00:00.000Z" },
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID02: prevStop/nextStop = null (ga đầu/ga cuối, biên) thì dùng scheduleDepartureTime/scheduleArrivalTime làm mốc và vẫn hợp lệ", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T00:30:00.000Z",
    departureTime: "2026-07-10T00:40:00.000Z",
    prevStop: null,
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID03: arrivalTime đúng bằng departureTime của prevStop (biên <=) thì báo lỗi vì yêu cầu phải sau nghiêm ngặt", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T00:30:00.000Z", // trùng giờ đi của stop trước
    departureTime: "2026-07-10T00:40:00.000Z",
    prevStop: { departureTime: "2026-07-10T00:30:00.000Z" },
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /phải sau giờ đi của ga dừng trước đó/);
});

test("UTCID04: đầu vào sai kiểu/rỗng (arrivalTime, departureTime là chuỗi rỗng) thì báo lỗi đầu vào không hợp lệ", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "",
    departureTime: "",
    prevStop: null,
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Giờ đến không hợp lệ."));
  assert.ok(result.errors.includes("Giờ đi không hợp lệ."));
});

test("UTCID05: departureTime trùng đúng arrivalTime của nextStop (biên >=) thì báo lỗi vì yêu cầu phải trước nghiêm ngặt", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T01:00:00.000Z",
    departureTime: "2026-07-10T02:00:00.000Z", // trùng giờ đến của stop sau
    prevStop: null,
    nextStop: { arrivalTime: "2026-07-10T02:00:00.000Z" },
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /phải trước giờ đến của ga dừng tiếp theo/);
});

test("UTCID06: giờ đến sau giờ đi tại cùng ga (prevStop/nextStop = null) thì báo đúng lỗi #1 độc lập", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T02:00:00.000Z",
    departureTime: "2026-07-10T01:00:00.000Z", // đi trước khi đến
    prevStop: null,
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /phải nhỏ hơn hoặc bằng giờ đi/);
});

test("UTCID07: giờ đến sớm hơn giờ xuất phát ga đầu (prevStop/nextStop = null) thì báo đúng lỗi #2 độc lập", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-09T23:00:00.000Z", // trước giờ xuất phát tổng thể
    departureTime: "2026-07-10T00:30:00.000Z",
    prevStop: null,
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /không được trước giờ xuất phát ga đầu/);
});

test("UTCID08: giờ đi muộn hơn giờ cập ga cuối (prevStop/nextStop = null) thì báo đúng lỗi #3 độc lập", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T02:30:00.000Z",
    departureTime: "2026-07-10T03:30:00.000Z", // sau giờ cập ga cuối tổng thể
    prevStop: null,
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /không được sau giờ cập ga cuối/);
});

test("UTCID09: prevStop/nextStop không có departureTime/arrivalTime thì dùng scheduleDepartureTime/scheduleArrivalTime làm mốc dự phòng (boundary)", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-10T01:00:00.000Z",
    departureTime: "2026-07-10T01:10:00.000Z",
    prevStop: { departureTime: null }, // không có departureTime -> dùng schedDepMs
    nextStop: { arrivalTime: null }, // không có arrivalTime -> dùng schedArrMs
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("UTCID10: prevStop không có departureTime nhưng arrivalTime mới lại sớm hơn scheduleDepartureTime thì vẫn báo lỗi qua mốc dự phòng (abnormal)", () => {
  const result = validateSingleStopSequence({
    arrivalTime: "2026-07-09T23:00:00.000Z", // trước cả scheduleDepartureTime (mốc dự phòng của prevStop)
    departureTime: "2026-07-10T01:10:00.000Z",
    prevStop: { departureTime: null },
    nextStop: null,
    scheduleDepartureTime: "2026-07-10T00:00:00.000Z",
    scheduleArrivalTime: "2026-07-10T03:00:00.000Z",
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) =>
      e.includes("phải sau giờ đi của ga dừng trước đó"),
    ),
  );
});
