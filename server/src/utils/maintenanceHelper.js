/**
 * Kiểm tra xem tàu có đang hoạt động trên đường ray tại thời điểm hiện tại hay không.
 * @param {Array} activeSchedules Danh sách các lịch trình đang hoạt động (không bị hủy).
 * @param {Date} now Thời điểm hiện tại.
 * @returns {Boolean} True nếu tàu đang chạy, ngược lại False.
 */
export function isTrainRunning(activeSchedules, now = new Date()) {
  const currentTime = new Date(now).getTime();
  return activeSchedules.some((s) => {
    const dep = new Date(s.departureTime).getTime();
    const arr = new Date(s.arrivalTime).getTime();
    return currentTime >= dep && currentTime <= arr;
  });
}

/**
 * Tính toán dịch chuyển thời gian của các ga dừng dựa trên số phút trễ.
 * @param {Array} stops Danh sách các ga dừng (ScheduleStop).
 * @param {Number} delayMinutes Số phút trễ.
 * @returns {Array} Danh sách ga dừng đã được cập nhật thời gian.
 */
export function shiftStopTimes(stops, delayMinutes) {
  const deltaMs = delayMinutes * 60 * 1000;
  return stops.map((stop) => {
    const arrivalTime = new Date(
      new Date(stop.arrivalTime).getTime() + deltaMs,
    );
    const departureTime = stop.departureTime
      ? new Date(new Date(stop.departureTime).getTime() + deltaMs)
      : null;
    return {
      ...stop,
      arrivalTime,
      departureTime,
    };
  });
}

/**
 * Kiểm tra xem có cần phát cảnh báo trễ chuyến tàu hay không (BR-32).
 * @param {Number} delayMinutes Số phút trễ.
 * @returns {Boolean} True nếu trễ trên 10 phút, ngược lại False.
 */
export function shouldTriggerDelayWarning(delayMinutes) {
  return Number(delayMinutes) > 10;
}
