/**
 * singleTrackValidator.js
 * Bộ quy tắc kiểm chứng vận hành đường đơn (Single-track Railway)
 * ─────────────────────────────────────────────────────────────────
 * Rule 1: Giãn cách cùng chiều ≥ MIN_GAP_MINUTES (mặc định 20 phút)
 * Rule 2: Không có 2 tàu ngược chiều cùng chiếm một phân đoạn ray
 * Rule 3: Thứ tự thời gian tuần tự tại các ga dừng
 */

import { prisma } from "../config/database.js";

/** Khoảng giãn cách tối thiểu (phút) giữa 2 tàu cùng chiều trên cùng tuyến */
const MIN_GAP_MINUTES = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Rule 1: Validate giãn cách cùng chiều
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Kiểm tra xem lịch trình mới có vi phạm giãn cách 20 phút với các tàu
 * khác chạy CÙNG CHIỀU trên cùng tuyến hay không.
 *
 * @param {object} params
 * @param {string} params.routeId       - ID tuyến đường
 * @param {Date}   params.departureTime - Giờ xuất phát ga đầu
 * @param {Date}   params.arrivalTime   - Giờ cập ga cuối
 * @param {string} [params.excludeScheduleId] - Bỏ qua lịch trình này (khi edit)
 * @param {number} [params.gapMinutes]  - Khoảng giãn cách tối thiểu (phút)
 * @returns {Promise<{valid: boolean, conflict?: object}>}
 */
export async function validateSameDirectionGap({
  routeId,
  departureTime,
  arrivalTime,
  excludeScheduleId = null,
  gapMinutes = MIN_GAP_MINUTES,
}) {
  const gapMs = gapMinutes * 60 * 1000;
  const depTime = new Date(departureTime).getTime();
  const arrTime = new Date(arrivalTime).getTime();

  if (isNaN(depTime) || isNaN(arrTime)) {
    return {
      valid: false,
      conflict: {
        type: "INVALID_INPUT",
        message: "Thời gian xuất phát hoặc thời gian đến không hợp lệ.",
      },
    };
  }

  // Tìm tất cả lịch chạy cùng tuyến (cùng routeId = cùng chiều), chưa bị hủy
  const sameDirectionSchedules = await prisma.schedule.findMany({
    where: {
      routeId,
      status: { not: "CANCELLED" },
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      // Chỉ tìm trong cửa sổ ±2 ngày để tối ưu performance
      departureTime: {
        gte: new Date(depTime - 2 * 24 * 60 * 60 * 1000),
        lte: new Date(arrTime + 2 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      departureTime: true,
      arrivalTime: true,
      train: { select: { trainCode: true } },
    },
  });

  for (const existing of sameDirectionSchedules) {
    const exDepMs = new Date(existing.departureTime).getTime();
    const exArrMs = new Date(existing.arrivalTime).getTime();

    // Vi phạm nếu: khoảng cách giờ xuất phát giữa 2 tàu < MIN_GAP_MINUTES
    const gap = Math.abs(depTime - exDepMs);
    if (gap < gapMs) {
      return {
        valid: false,
        conflict: {
          type: "SAME_DIRECTION_GAP",
          conflictingScheduleId: existing.id,
          conflictingTrain: existing.train?.trainCode,
          conflictingDeparture: existing.departureTime,
          gapMinutes: Math.floor(gap / 60000),
          requiredGapMinutes: gapMinutes,
          message: `Tàu ${existing.train?.trainCode || "khác"} xuất phát lúc ${new Date(existing.departureTime).toLocaleString("vi-VN")} cùng tuyến này. Khoảng giãn cách hiện tại chỉ ${Math.floor(gap / 60000)} phút (yêu cầu tối thiểu ${gapMinutes} phút).`,
        },
      };
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule 2: Validate tránh tàu ngược chiều
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Kiểm tra xung đột tàu ngược chiều trên phân đoạn ray đơn.
 *
 * Nguyên tắc: Nếu Tàu A đang chiếm đoạn ray [GaX → GaY], thì Tàu B
 * KHÔNG được rời GaY về hướng GaX cho đến khi Tàu A đã cập GaY an toàn.
 *
 * Cách xác định "route ngược chiều": tìm route có
 *   startStationId == proposed.endStationId AND endStationId == proposed.startStationId
 *
 * @param {object} params
 * @param {string} params.startStationId  - Ga đầu của lịch mới
 * @param {string} params.endStationId    - Ga cuối của lịch mới
 * @param {Date}   params.departureTime   - Giờ xuất phát
 * @param {Date}   params.arrivalTime     - Giờ cập ga cuối
 * @param {Array}  params.proposedStops   - [{stationId, arrivalTime, departureTime, stopOrder}]
 * @param {string} [params.excludeScheduleId]
 * @returns {Promise<{valid: boolean, conflict?: object}>}
 */
export async function validateOpposingDirectionConflict({
  startStationId,
  endStationId,
  departureTime,
  arrivalTime,
  proposedStops = [],
  excludeScheduleId = null,
}) {
  // Tìm route ngược chiều
  const opposingRoutes = await prisma.route.findMany({
    where: {
      startStationId: endStationId,
      endStationId: startStationId,
      isActive: true,
    },
    select: { id: true },
  });

  if (opposingRoutes.length === 0) {
    // Không có tuyến ngược chiều — không cần validate
    return { valid: true };
  }

  const opposingRouteIds = opposingRoutes.map((r) => r.id);
  const depMs = new Date(departureTime).getTime();
  const arrMs = new Date(arrivalTime).getTime();

  // Lấy các lịch trình ngược chiều trong cùng khung giờ (±12h)
  const opposingSchedules = await prisma.schedule.findMany({
    where: {
      routeId: { in: opposingRouteIds },
      status: { not: "CANCELLED" },
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
      departureTime: {
        gte: new Date(depMs - 12 * 3600 * 1000),
        lte: new Date(arrMs + 12 * 3600 * 1000),
      },
    },
    include: {
      scheduleStops: {
        orderBy: { stopOrder: "asc" },
        include: {
          station: { select: { id: true, stationName: true } },
        },
      },
      train: { select: { trainCode: true } },
      route: {
        select: {
          startStation: { select: { id: true, stationName: true } },
          endStation: { select: { id: true, stationName: true } },
        },
      },
    },
  });

  if (opposingSchedules.length === 0) return { valid: true };

  // Xây dựng danh sách điểm thời gian của lịch mới (proposed)
  // Bao gồm: ga đầu (dep), các ga trung gian, ga cuối (arr)
  const proposedPoints = [
    {
      stationId: startStationId,
      departureTime: new Date(departureTime),
      arrivalTime: null,
    },
    ...proposedStops
      .sort((a, b) => a.stopOrder - b.stopOrder)
      .map((s) => ({
        stationId: s.stationId,
        arrivalTime: s.arrivalTime ? new Date(s.arrivalTime) : null,
        departureTime: s.departureTime ? new Date(s.departureTime) : null,
      })),
    {
      stationId: endStationId,
      arrivalTime: new Date(arrivalTime),
      departureTime: null,
    },
  ];

  // Với mỗi tàu ngược chiều, kiểm tra từng phân đoạn
  for (const opp of opposingSchedules) {
    // Xây dựng điểm thời gian của tàu ngược chiều
    // Tàu ngược chiều đi từ endStationId → startStationId
    const oppPoints = [
      {
        stationId: opp.route.startStation.id,
        stationName: opp.route.startStation.stationName,
        departureTime: new Date(opp.departureTime),
        arrivalTime: null,
      },
      ...opp.scheduleStops.map((ss) => ({
        stationId: ss.station.id,
        stationName: ss.station.stationName,
        arrivalTime: ss.arrivalTime ? new Date(ss.arrivalTime) : null,
        departureTime: ss.departureTime ? new Date(ss.departureTime) : null,
      })),
      {
        stationId: opp.route.endStation.id,
        stationName: opp.route.endStation.stationName,
        arrivalTime: new Date(opp.arrivalTime),
        departureTime: null,
      },
    ];

    // Kiểm tra từng phân đoạn [i → i+1] của tàu đề xuất
    for (let i = 0; i < proposedPoints.length - 1; i++) {
      const segStart = proposedPoints[i];
      const segEnd = proposedPoints[i + 1];

      // Tàu đề xuất rời segStart.stationId lúc:
      const propDepAtSegStart = segStart.departureTime || segStart.arrivalTime;
      // Tàu đề xuất đến segEnd.stationId lúc:
      const propArrAtSegEnd = segEnd.arrivalTime || segEnd.departureTime;

      if (!propDepAtSegStart || !propArrAtSegEnd) continue;

      // Tìm xem tàu ngược chiều có đang trên đoạn [segEnd → segStart] không
      // (tức là đoạn ray ngược lại của phân đoạn hiện tại)
      const oppSegStartIdx = oppPoints.findIndex(
        (p) => p.stationId === segEnd.stationId,
      );
      const oppSegEndIdx = oppPoints.findIndex(
        (p) => p.stationId === segStart.stationId,
      );

      if (oppSegStartIdx === -1 || oppSegEndIdx === -1) continue;
      if (oppSegStartIdx >= oppSegEndIdx) continue; // Đảm bảo thứ tự hợp lệ

      const oppDepAtSegStart = oppPoints[oppSegStartIdx].departureTime;
      const oppArrAtSegEnd = oppPoints[oppSegEndIdx].arrivalTime;

      if (!oppDepAtSegStart || !oppArrAtSegEnd) continue;

      // Vi phạm: hai tàu cùng trên đoạn ray đơn [A↔B] trong cùng một khoảng thời gian
      // Tàu đề xuất: [propDepAtSegStart, propArrAtSegEnd]
      // Tàu ngược chiều: [oppDepAtSegStart, oppArrAtSegEnd]
      const propDepMs = propDepAtSegStart.getTime();
      const propArrMs = propArrAtSegEnd.getTime();
      const oppDepMs = oppDepAtSegStart.getTime();
      const oppArrMs = oppArrAtSegEnd.getTime();

      // Overlap nếu khoảng thời gian giao nhau
      if (propDepMs < oppArrMs && propArrMs > oppDepMs) {
        const gaStartName =
          proposedPoints[i].stationId === startStationId
            ? "Ga khởi hành"
            : `Ga ${segStart.stationId}`;
        const gaEndName =
          segEnd.stationId === endStationId
            ? "Ga kết thúc"
            : `Ga ${segEnd.stationId}`;

        // Tính giờ an toàn tối thiểu: sau khi tàu ngược chiều cập ga
        const suggestedDepTime = new Date(oppArrMs + 5 * 60 * 1000); // +5 phút buffer

        return {
          valid: false,
          conflict: {
            type: "OPPOSING_DIRECTION",
            conflictingScheduleId: opp.id,
            conflictingTrain: opp.train?.trainCode,
            segmentFrom: gaStartName,
            segmentTo: gaEndName,
            opposingArrivalAtClearPoint: oppArrAtSegEnd,
            suggestedDepartureTime: suggestedDepTime,
            message: `Tàu ${opp.train?.trainCode || "ngược chiều"} đang trên đoạn ray đơn [${oppPoints[oppSegStartIdx]?.stationName || gaEndName} → ${oppPoints[oppSegEndIdx]?.stationName || gaStartName}], dự kiến cập ga lúc ${oppArrAtSegEnd.toLocaleString("vi-VN")}. Tàu này phải chờ tàu ngược chiều thông tuyến.`,
          },
        };
      }
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule 3: Validate tính tuần tự thời gian của ScheduleStop
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Kiểm tra tính tuần tự của danh sách ga dừng.
 *
 * Quy tắc:
 *  - arrivalTime[N] ≤ departureTime[N] (tại cùng ga: đến trước khi đi)
 *  - departureTime[N] < arrivalTime[N+1] (rời ga trước → đến ga sau)
 *  - Không được sớm hơn scheduleDepartureTime hoặc muộn hơn scheduleArrivalTime
 *
 * @param {object} params
 * @param {Array}  params.stops               - [{stationId, stopOrder, arrivalTime, departureTime}]
 * @param {Date}   params.scheduleDepartureTime - Giờ xuất phát ga đầu
 * @param {Date}   params.scheduleArrivalTime   - Giờ cập ga cuối
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateStopTimeSequence({
  stops,
  scheduleDepartureTime,
  scheduleArrivalTime,
}) {
  const errors = [];

  if (!stops || stops.length === 0) return { valid: true, errors: [] };

  const sorted = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
  const schedDepMs = new Date(scheduleDepartureTime).getTime();
  const schedArrMs = new Date(scheduleArrivalTime).getTime();

  for (let i = 0; i < sorted.length; i++) {
    const stop = sorted[i];
    const arrMs = stop.arrivalTime
      ? new Date(stop.arrivalTime).getTime()
      : null;
    const depMs = stop.departureTime
      ? new Date(stop.departureTime).getTime()
      : null;

    if (stop.arrivalTime && isNaN(arrMs)) {
      errors.push(`Ga dừng #${stop.stopOrder}: Giờ đến không hợp lệ.`);
    }
    if (stop.departureTime && isNaN(depMs)) {
      errors.push(`Ga dừng #${stop.stopOrder}: Giờ đi không hợp lệ.`);
    }

    // Quy tắc: arrivalTime ≤ departureTime tại cùng ga
    if (
      arrMs !== null &&
      !isNaN(arrMs) &&
      depMs !== null &&
      !isNaN(depMs) &&
      arrMs > depMs
    ) {
      errors.push(
        `Ga dừng #${stop.stopOrder}: Giờ đến (${new Date(stop.arrivalTime).toLocaleString("vi-VN")}) phải nhỏ hơn hoặc bằng giờ đi (${new Date(stop.departureTime).toLocaleString("vi-VN")}).`,
      );
    }

    // Quy tắc: Không được sớm hơn giờ xuất phát ga đầu
    if (
      arrMs !== null &&
      !isNaN(arrMs) &&
      !isNaN(schedDepMs) &&
      arrMs < schedDepMs
    ) {
      errors.push(
        `Ga dừng #${stop.stopOrder}: Giờ đến (${new Date(stop.arrivalTime).toLocaleString("vi-VN")}) không được trước giờ xuất phát ga đầu (${new Date(scheduleDepartureTime).toLocaleString("vi-VN")}).`,
      );
    }

    // Quy tắc: Không được muộn hơn giờ cập ga cuối
    if (
      depMs !== null &&
      !isNaN(depMs) &&
      !isNaN(schedArrMs) &&
      depMs > schedArrMs
    ) {
      errors.push(
        `Ga dừng #${stop.stopOrder}: Giờ đi (${new Date(stop.departureTime).toLocaleString("vi-VN")}) không được sau giờ cập ga cuối (${new Date(scheduleArrivalTime).toLocaleString("vi-VN")}).`,
      );
    }

    // Quy tắc: departureTime[N] < arrivalTime[N+1]
    if (i < sorted.length - 1) {
      const nextStop = sorted[i + 1];
      const nextArrMs = nextStop.arrivalTime
        ? new Date(nextStop.arrivalTime).getTime()
        : null;

      if (
        depMs !== null &&
        !isNaN(depMs) &&
        nextArrMs !== null &&
        !isNaN(nextArrMs) &&
        depMs >= nextArrMs
      ) {
        errors.push(
          `Ga dừng #${stop.stopOrder} → #${nextStop.stopOrder}: Giờ đi khỏi ga #${stop.stopOrder} (${new Date(stop.departureTime).toLocaleString("vi-VN")}) phải trước giờ đến ga #${nextStop.stopOrder} (${new Date(nextStop.arrivalTime).toLocaleString("vi-VN")}).`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate đơn lẻ một ScheduleStop (dùng khi Admin chỉnh sửa 1 stop)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Kiểm tra tính tuần tự của một ScheduleStop đang được chỉnh sửa,
 * dựa trên stop trước và stop sau trong cùng lịch trình.
 *
 * @param {object} params
 * @param {Date}   params.arrivalTime          - Giờ đến mới
 * @param {Date}   params.departureTime        - Giờ đi mới
 * @param {object|null} params.prevStop        - Stop trước: {departureTime} hoặc null (ga đầu)
 * @param {object|null} params.nextStop        - Stop sau: {arrivalTime} hoặc null (ga cuối)
 * @param {Date}   params.scheduleDepartureTime - Giờ xuất phát tổng thể
 * @param {Date}   params.scheduleArrivalTime  - Giờ cập ga cuối tổng thể
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateSingleStopSequence({
  arrivalTime,
  departureTime,
  prevStop,
  nextStop,
  scheduleDepartureTime,
  scheduleArrivalTime,
}) {
  const errors = [];
  const arrMs = new Date(arrivalTime).getTime();
  const depMs = new Date(departureTime).getTime();
  const schedDepMs = new Date(scheduleDepartureTime).getTime();
  const schedArrMs = new Date(scheduleArrivalTime).getTime();

  if (isNaN(arrMs)) {
    errors.push("Giờ đến không hợp lệ.");
  }
  if (isNaN(depMs)) {
    errors.push("Giờ đi không hợp lệ.");
  }

  // 1. arrivalTime ≤ departureTime tại cùng ga
  if (!isNaN(arrMs) && !isNaN(depMs) && arrMs > depMs) {
    errors.push(
      `Giờ đến (${new Date(arrivalTime).toLocaleString("vi-VN")}) phải nhỏ hơn hoặc bằng giờ đi (${new Date(departureTime).toLocaleString("vi-VN")}).`,
    );
  }

  // 2. Không được sớm hơn giờ xuất phát ga đầu
  if (!isNaN(arrMs) && !isNaN(schedDepMs) && arrMs < schedDepMs) {
    errors.push(
      `Giờ đến không được trước giờ xuất phát ga đầu (${new Date(scheduleDepartureTime).toLocaleString("vi-VN")}).`,
    );
  }

  // 3. Không được muộn hơn giờ cập ga cuối
  if (!isNaN(depMs) && !isNaN(schedArrMs) && depMs > schedArrMs) {
    errors.push(
      `Giờ đi không được sau giờ cập ga cuối (${new Date(scheduleArrivalTime).toLocaleString("vi-VN")}).`,
    );
  }

  // 4. Phải sau stop trước
  if (prevStop && !isNaN(arrMs)) {
    const prevDepMs = prevStop.departureTime
      ? new Date(prevStop.departureTime).getTime()
      : schedDepMs;
    if (!isNaN(prevDepMs) && arrMs <= prevDepMs) {
      errors.push(
        `Giờ đến (${new Date(arrivalTime).toLocaleString("vi-VN")}) phải sau giờ đi của ga dừng trước đó (${new Date(prevStop.departureTime || scheduleDepartureTime).toLocaleString("vi-VN")}).`,
      );
    }
  }

  // 5. Phải trước stop sau
  if (nextStop && !isNaN(depMs)) {
    const nextArrMs = nextStop.arrivalTime
      ? new Date(nextStop.arrivalTime).getTime()
      : schedArrMs;
    if (!isNaN(nextArrMs) && depMs >= nextArrMs) {
      errors.push(
        `Giờ đi (${new Date(departureTime).toLocaleString("vi-VN")}) phải trước giờ đến của ga dừng tiếp theo (${new Date(nextStop.arrivalTime || scheduleArrivalTime).toLocaleString("vi-VN")}).`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
