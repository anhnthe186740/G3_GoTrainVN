export const CARRIAGE_LAYOUT = [
  "NORMAL_SEAT",
  "AC_SEAT",
  "SLEEPER_6",
  "SLEEPER_4",
];

const SEATS_PER_CARRIAGE = {
  NORMAL_SEAT: 40,
  AC_SEAT: 28,
  SLEEPER_6: 24,
  SLEEPER_4: 16,
};

export function buildCarriageConfigs(carriages) {
  if (!Array.isArray(carriages) || carriages.length === 0) {
    throw new Error("Cấu hình toa tàu không hợp lệ.");
  }

  return carriages.map((carriageType, index) => {
    const totalSeats = SEATS_PER_CARRIAGE[carriageType];
    if (!totalSeats) {
      throw new Error(`Loại toa không hợp lệ: ${carriageType}`);
    }

    return {
      carriageNumber: index + 1,
      carriageType,
      totalSeats,
    };
  });
}

export function buildDefaultCarriageTypes(totalCarriages) {
  const count = Number(totalCarriages);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Số lượng toa tàu không hợp lệ.");
  }

  return Array.from(
    { length: count },
    (_, index) => CARRIAGE_LAYOUT[index % CARRIAGE_LAYOUT.length],
  );
}

export function buildSeats(carriageId, carriageType) {
  if (carriageType === "NORMAL_SEAT" || carriageType === "AC_SEAT") {
    return Array.from(
      { length: SEATS_PER_CARRIAGE[carriageType] },
      (_, index) => {
        const seatNumber = index + 1;
        const column = index % 4;
        return {
          carriageId,
          seatNumber: String(seatNumber),
          seatType: column === 0 || column === 3 ? "WINDOW" : "AISLE",
          status: "AVAILABLE",
          basePrice: carriageType === "NORMAL_SEAT" ? 100000 : 120000,
        };
      },
    );
  }

  const floors = carriageType === "SLEEPER_6" ? ["1", "2", "3"] : ["1", "2"];
  const basePrice = carriageType === "SLEEPER_6" ? 150000 : 180000;

  if (!SEATS_PER_CARRIAGE[carriageType]) {
    throw new Error(`Loại toa không hợp lệ: ${carriageType}`);
  }

  return Array.from({ length: 4 }, (_, compartmentIndex) =>
    floors.flatMap((floor) =>
      ["A", "B"].map((side) => ({
        carriageId,
        seatNumber: `K${compartmentIndex + 1}-T${floor}-${side}`,
        seatType:
          floor === "1"
            ? "WINDOW"
            : carriageType === "SLEEPER_6" && floor === "2"
              ? "MIDDLE"
              : "AISLE",
        status: "AVAILABLE",
        basePrice,
      })),
    ),
  ).flat();
}

export async function createTrainInventory(client, trainId, carriageTypes) {
  const configs = buildCarriageConfigs(carriageTypes);

  for (const config of configs) {
    const carriage = await client.carriage.create({
      data: {
        trainId,
        ...config,
      },
    });

    await client.seat.createMany({
      data: buildSeats(carriage.id, config.carriageType),
    });
  }

  return {
    totalCarriages: configs.length,
    totalCapacity: configs.reduce(
      (total, config) => total + config.totalSeats,
      0,
    ),
  };
}
