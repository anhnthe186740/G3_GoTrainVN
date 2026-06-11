import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting booking seeding script...");

  // 1. Ensure Demo User Exists
  const email = "demo@test.com";
  let demoUser = await prisma.user.findUnique({ where: { email } });

  const hashedPassword = await bcrypt.hash("password123", 10);

  if (!demoUser) {
    console.log("Creating demo user...");
    demoUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: "Hoàng Linh",
        phoneNumber: "0987654321",
        userType: "CUSTOMER",
        loyaltyPoints: 120,
      },
    });
  } else {
    console.log("Demo user already exists:", demoUser.fullName);
  }

  // 2. Ensure User Wallet Exists
  let wallet = await prisma.wallet.findUnique({
    where: { userId: demoUser.id },
  });
  if (!wallet) {
    console.log("Creating wallet for demo user...");
    wallet = await prisma.wallet.create({
      data: {
        userId: demoUser.id,
        balance: 1500000, // 1.5M VND
        currency: "VND",
      },
    });
  } else {
    console.log("Wallet already exists. Balance:", wallet.balance);
  }

  // 3. Fetch reference data (Station, Route, Train, Carriage, Seat)
  const stations = await prisma.station.findMany({ take: 2 });
  if (stations.length < 2) {
    console.log(
      "❌ Error: Need at least 2 stations to seed. Please run npm run seed first.",
    );
    return;
  }
  const startStation = stations[0];
  const endStation = stations[1];

  let route = await prisma.route.findFirst();
  if (!route) {
    console.log("Creating a mock route...");
    route = await prisma.route.create({
      data: {
        routeName: `${startStation.stationName} - ${endStation.stationName}`,
        startStationId: startStation.id,
        endStationId: endStation.id,
        distance: 350,
        estimatedDuration: 480, // 8 hours
      },
    });
  }

  const train = await prisma.train.findFirst();
  if (!train) {
    console.log("❌ Error: No train found. Please seed trains first.");
    return;
  }

  // Check or create carriages and seats if empty
  let carriage = await prisma.carriage.findFirst({
    where: { trainId: train.id },
  });
  if (!carriage) {
    console.log("Creating a carriage for train:", train.trainName);
    carriage = await prisma.carriage.create({
      data: {
        trainId: train.id,
        carriageNumber: 1,
        carriageType: "AC_SEAT",
        totalSeats: 30,
      },
    });
  }

  let seats = await prisma.seat.findMany({
    where: { carriageId: carriage.id },
  });
  if (seats.length === 0) {
    console.log("Creating seats for carriage...");
    const seatData = [];
    for (let i = 1; i <= 10; i++) {
      seatData.push({
        carriageId: carriage.id,
        seatNumber: `A${i.toString().padStart(2, "0")}`,
        seatType: i % 2 === 0 ? "WINDOW" : "AISLE",
        basePrice: 450000,
        status: "AVAILABLE",
      });
    }
    await prisma.seat.createMany({ data: seatData });
    seats = await prisma.seat.findMany({ where: { carriageId: carriage.id } });
  }

  // 4. Create Schedules
  console.log("Creating schedules (Past, Tomorrow, Next Week)...");
  const now = new Date();

  // Past Schedule (Departed 5 days ago)
  const pastDeparture = new Date(now);
  pastDeparture.setDate(now.getDate() - 5);
  const pastArrival = new Date(pastDeparture.getTime() + 8 * 60 * 60 * 1000); // +8h

  // Tomorrow Schedule
  const tomorrowDeparture = new Date(now);
  tomorrowDeparture.setDate(now.getDate() + 1);
  tomorrowDeparture.setHours(8, 0, 0, 0); // 8:00 AM
  const tomorrowArrival = new Date(
    tomorrowDeparture.getTime() + 8 * 60 * 60 * 1000,
  );

  // Next Week Schedule
  const nextWeekDeparture = new Date(now);
  nextWeekDeparture.setDate(now.getDate() + 7);
  nextWeekDeparture.setHours(14, 30, 0, 0); // 2:30 PM
  const nextWeekArrival = new Date(
    nextWeekDeparture.getTime() + 8 * 60 * 60 * 1000,
  );

  const schedulesData = [
    {
      trainId: train.id,
      routeId: route.id,
      startStationId: startStation.id,
      endStationId: endStation.id,
      departureTime: pastDeparture,
      arrivalTime: pastArrival,
      status: "ACTIVE",
    },
    {
      trainId: train.id,
      routeId: route.id,
      startStationId: startStation.id,
      endStationId: endStation.id,
      departureTime: tomorrowDeparture,
      arrivalTime: tomorrowArrival,
      status: "ACTIVE",
    },
    {
      trainId: train.id,
      routeId: route.id,
      startStationId: startStation.id,
      endStationId: endStation.id,
      departureTime: nextWeekDeparture,
      arrivalTime: nextWeekArrival,
      status: "ACTIVE",
    },
  ];

  const schedules = [];
  for (const s of schedulesData) {
    // Check if duplicate exists to avoid unique constraint violations
    const existing = await prisma.schedule.findFirst({
      where: {
        trainId: s.trainId,
        startStationId: s.startStationId,
        endStationId: s.endStationId,
        departureTime: s.departureTime,
      },
    });
    if (existing) {
      schedules.push(existing);
    } else {
      const created = await prisma.schedule.create({ data: s });
      schedules.push(created);
    }
  }

  // 5. Create Bookings & Passengers
  console.log("Seeding Bookings...");

  const mockTickets = [
    {
      bookingCode: "BK2026PAST",
      ticketCode: "GT2026A01",
      schedule: schedules[0],
      seat: seats[0],
      status: "COMPLETED",
      paymentStatus: "COMPLETED",
    },
    {
      bookingCode: "BK2026NEAR",
      ticketCode: "GT2026A02",
      schedule: schedules[1],
      seat: seats[1],
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
    },
    {
      bookingCode: "BK2026FAR",
      ticketCode: "GT2026A03",
      schedule: schedules[2],
      seat: seats[2],
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
    },
  ];

  for (const t of mockTickets) {
    // Check if booking already exists
    const existingBooking = await prisma.booking.findUnique({
      where: { bookingCode: t.bookingCode },
    });

    if (existingBooking) {
      console.log(`Booking ${t.bookingCode} already exists.`);
      continue;
    }

    // Create Booking
    const booking = await prisma.booking.create({
      data: {
        bookingCode: t.bookingCode,
        userId: demoUser.id,
        scheduleId: t.schedule.id,
        bookingType: "ONE_WAY",
        totalPassengers: 1,
        subtotal: 450000,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 450000,
        paymentMethod: "WALLET",
        paymentStatus: t.paymentStatus,
        status: t.status,
        confirmationEmail: demoUser.email,
      },
    });

    // Create Passenger
    const passenger = await prisma.passenger.create({
      data: {
        bookingId: booking.id,
        userId: demoUser.id,
        fullName: demoUser.fullName,
        phoneNumber: demoUser.phoneNumber,
        email: demoUser.email,
        passengerType: "ADULT",
        ticketCode: t.ticketCode,
        seatId: t.seat.id,
        carriageNumber: carriage.carriageNumber,
      },
    });

    // Create BookingDetail
    await prisma.bookingDetail.create({
      data: {
        bookingId: booking.id,
        passengerId: passenger.id,
        seatId: t.seat.id,
        carriageType: carriage.carriageType,
        basePrice: 450000,
        discountAmount: 0,
        finalPrice: 450000,
        status: "CONFIRMED",
      },
    });

    // Update seat status
    await prisma.seat.update({
      where: { id: t.seat.id },
      data: { status: "BOOKED" },
    });

    console.log(`Created booking ${t.bookingCode} with ticket ${t.ticketCode}`);
  }

  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
  })
  .finally(() => prisma.$disconnect());
