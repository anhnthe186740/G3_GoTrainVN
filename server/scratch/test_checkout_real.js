import { prisma } from "../src/config/database.js";
import { checkoutBooking } from "../src/services/bookingCheckout.service.js";

async function main() {
  console.log("Starting test checkout on real database...");

  // 1. Find an active schedule in the future and its route stations
  const schedule = await prisma.schedule.findFirst({
    where: {
      status: "ACTIVE",
      departureTime: { gt: new Date() },
      route: { isActive: true },
    },
    include: {
      route: true,
      train: {
        include: {
          carriages: {
            include: {
              seats: true,
            },
          },
        },
      },
    },
  });

  if (!schedule) {
    console.error("No active schedule found in database.");
    return;
  }

  const fromStationId = schedule.route.startStationId;
  const toStationId = schedule.route.endStationId;

  console.log(
    `Using schedule: ${schedule.id} on train ${schedule.train.trainName}`,
  );
  console.log(`From Station: ${fromStationId}, To Station: ${toStationId}`);

  // Find 1 available seat on this schedule
  let targetSeat = null;
  for (const carriage of schedule.train.carriages) {
    for (const seat of carriage.seats) {
      // Check if there is already a seat hold or booking for this seat on this schedule
      const existingHold = await prisma.seatHold.findFirst({
        where: { scheduleId: schedule.id, seatId: seat.id },
      });
      const existingBookingDetail = await prisma.bookingDetail.findFirst({
        where: {
          scheduleId: schedule.id,
          seatId: seat.id,
          status: "CONFIRMED",
        },
      });
      if (!existingHold && !existingBookingDetail) {
        targetSeat = { seat, carriage };
        break;
      }
    }
    if (targetSeat) break;
  }

  if (!targetSeat) {
    console.error("No available seats found on schedule.");
    return;
  }
  console.log(
    `Found target seat: ${targetSeat.seat.seatNumber} in carriage ${targetSeat.carriage.carriageNumber}`,
  );

  // 2. Create seat hold session
  const identity = { userId: null, guestToken: "test-guest-token-123" };
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  const session = await prisma.seatHoldSession.create({
    data: {
      guestToken: identity.guestToken,
      bookingType: "ONE_WAY",
      outboundScheduleId: schedule.id,
      outboundFromStationId: fromStationId,
      outboundToStationId: toStationId,
      status: "ACTIVE",
      expiresAt,
      holds: {
        create: {
          guestToken: identity.guestToken,
          scheduleId: schedule.id,
          seatId: targetSeat.seat.id,
          carriageType: targetSeat.carriage.carriageType,
          priceSnapshot: 100000,
          expiresAt,
        },
      },
    },
    include: { holds: true },
  });

  console.log(`Created SeatHoldSession: ${session.id}`);

  // 3. Attempt checkout
  const payload = {
    sessionId: session.id,
    passengers: [
      {
        fullName: "Adult Passenger",
        dateOfBirth: "1990-01-01",
        passengerType: "ADULT",
        nationalIdType: "CCCD",
        nationalId: "012345678901",
        phoneNumber: "0912345678",
        email: "adult@example.com",
      },
      {
        fullName: "Child Passenger",
        dateOfBirth: "2022-01-01",
        passengerType: "CHILD",
        seatRequired: false,
      },
    ],
    paymentMethod: "BANK_QR",
    salesChannel: "ONLINE",
  };

  try {
    const result = await checkoutBooking(identity, payload);
    console.log("Checkout succeeded!");
    console.log("Booking ID:", result.booking.id);
    console.log("Booking Code:", result.booking.bookingCode);
    console.log("Total Amount:", result.booking.totalAmount);
    console.log(
      "Passengers:",
      result.passengers.map((p) => ({
        fullName: p.fullName,
        passengerType: p.passengerType,
        discountPercentage: p.discountPercentage,
        seatId: p.seatId,
        carriageNumber: p.carriageNumber,
      })),
    );

    // Now test payment confirmation
    console.log("Testing confirmQrPayment...");
    const { confirmQrPayment } =
      await import("../src/services/bookingCheckout.service.js");
    const paymentResult = await confirmQrPayment(identity, result.booking.id);
    console.log(
      "Payment confirmation succeeded! Booking status:",
      paymentResult.status,
    );
  } catch (error) {
    console.error("Checkout/Payment failed with error:", error);
    if (error.details) {
      console.error("Error details:", JSON.stringify(error.details, null, 2));
    }
  } finally {
    // Cleanup
    await prisma.bookingDetail.deleteMany({
      where: { booking: { guestToken: identity.guestToken } },
    });
    await prisma.passenger.deleteMany({
      where: { booking: { guestToken: identity.guestToken } },
    });
    await prisma.bookingPaymentHistory.deleteMany({
      where: { booking: { guestToken: identity.guestToken } },
    });
    await prisma.booking.deleteMany({
      where: { guestToken: identity.guestToken },
    });
    await prisma.seatHold.deleteMany({ where: { sessionId: session.id } });
    await prisma.seatHoldSession.delete({ where: { id: session.id } });
    console.log("Cleanup done.");
  }
}

main()
  .catch((e) => {
    console.error("Error in main:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
