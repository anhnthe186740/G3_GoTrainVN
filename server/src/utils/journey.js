const VIETNAM_OFFSET = "+07:00";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function parseVietnamDateRange(value, fieldName = "Ngày đi") {
  if (!DATE_PATTERN.test(String(value))) {
    throw httpError(400, `${fieldName} không hợp lệ.`);
  }

  const start = new Date(`${value}T00:00:00.000${VIETNAM_OFFSET}`);
  if (Number.isNaN(start.getTime())) {
    throw httpError(400, `${fieldName} không hợp lệ.`);
  }

  const normalized = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);

  if (normalized !== value) {
    throw httpError(400, `${fieldName} không hợp lệ.`);
  }

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000),
  };
}

export function buildSchedulePoints(schedule) {
  const routeStops = [...(schedule.route.stations || [])].sort(
    (a, b) => a.stopOrder - b.stopOrder,
  );
  const scheduleStops = new Map(
    (schedule.scheduleStops || []).map((stop) => [stop.stationId, stop]),
  );
  const totalDistance = Math.max(
    1,
    Number(schedule.distance ?? schedule.route.distance),
  );
  const delayMs =
    schedule.status === "DELAYED"
      ? Math.max(0, Number(schedule.delayMinutes || 0)) * 60000
      : 0;
  const departureMs = new Date(schedule.departureTime).getTime() + delayMs;
  const arrivalMs = new Date(schedule.arrivalTime).getTime() + delayMs;
  const durationMs = Math.max(0, arrivalMs - departureMs);
  const withDelay = (value) =>
    value ? new Date(new Date(value).getTime() + delayMs) : null;

  const intermediatePoints = routeStops.map((routeStop, index) => {
    const recordedStop = scheduleStops.get(routeStop.stationId);
    const ratio = Math.min(
      1,
      Math.max(0, Number(routeStop.distanceFromStart) / totalDistance),
    );
    const estimatedTime = new Date(departureMs + durationMs * ratio);

    return {
      stationId: routeStop.stationId,
      stationName: routeStop.stationName,
      order: index + 1,
      distanceFromStart: Number(routeStop.distanceFromStart),
      arrivalTime: withDelay(recordedStop?.arrivalTime) || estimatedTime,
      departureTime:
        withDelay(recordedStop?.departureTime) ||
        withDelay(recordedStop?.arrivalTime) ||
        estimatedTime,
    };
  });

  return [
    {
      stationId: schedule.route.startStation.id,
      stationName: schedule.route.startStation.stationName,
      order: 0,
      distanceFromStart: 0,
      arrivalTime: new Date(departureMs),
      departureTime: new Date(departureMs),
    },
    ...intermediatePoints,
    {
      stationId: schedule.route.endStation.id,
      stationName: schedule.route.endStation.stationName,
      order: intermediatePoints.length + 1,
      distanceFromStart: totalDistance,
      arrivalTime: new Date(arrivalMs),
      departureTime: new Date(arrivalMs),
    },
  ];
}

export function resolveJourneySegment(schedule, fromStationId, toStationId) {
  const points = buildSchedulePoints(schedule);
  const originIndex = points.findIndex(
    (point) => point.stationId === fromStationId,
  );
  const destinationIndex = points.findIndex(
    (point) => point.stationId === toStationId,
  );

  if (
    originIndex < 0 ||
    destinationIndex < 0 ||
    originIndex >= destinationIndex
  ) {
    return null;
  }

  const origin = points[originIndex];
  const destination = points[destinationIndex];
  const departureTime = new Date(origin.departureTime);
  const arrivalTime = new Date(destination.arrivalTime);

  return {
    origin,
    destination,
    departureTime,
    arrivalTime,
    duration: Math.max(
      0,
      Math.round((arrivalTime.getTime() - departureTime.getTime()) / 60000),
    ),
    distance: Math.max(
      1,
      destination.distanceFromStart - origin.distanceFromStart,
    ),
    stops: points.slice(originIndex + 1, destinationIndex),
  };
}

export function isDepartureWithinRange(segment, range, now = new Date()) {
  const departureMs = segment.departureTime.getTime();
  return (
    departureMs >= range.start.getTime() &&
    departureMs < range.end.getTime() &&
    departureMs > now.getTime()
  );
}
