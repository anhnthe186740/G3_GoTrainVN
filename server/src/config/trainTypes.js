export const TRAIN_TYPE_CONFIGS = {
  SE: {
    name: "Tàu Thống Nhất Tốc Hành (SE)",
    speedFactor: 1.0,
    priceFactor: 1.0,
    badge: "bg-primary-fixed text-on-primary-fixed",
  },
  TN: {
    name: "Tàu Thường Thống Nhất (TN)",
    speedFactor: 1.3, // 30% slower
    priceFactor: 0.85, // 15% cheaper
    badge: "bg-surface-container-highest text-on-surface-variant",
  },
};

export function getTrainTypeSpeedFactor(type) {
  return TRAIN_TYPE_CONFIGS[type]?.speedFactor ?? 1.0;
}

export function getTrainTypePriceFactor(type) {
  return TRAIN_TYPE_CONFIGS[type]?.priceFactor ?? 1.0;
}
