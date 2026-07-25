// Quick manual test of the child seat fix
import {
  normalizePassenger,
  normalizeQuotePassenger,
  calculatePassengerAge,
} from "../src/services/bookingCheckout.service.js";

const TODAY = new Date("2026-07-25T10:00:00+07:00");
const DOB_UNDER_6 = "2023-01-01"; // age 3

// Scenario 1: Lap child (under 6, no seat, free)
try {
  const lapChild = normalizePassenger(
    {
      fullName: "Be An",
      dateOfBirth: DOB_UNDER_6,
      passengerType: "CHILD",
      seatRequired: false,
      nationalIdType: "",
      nationalId: "",
      phoneNumber: "",
      email: "",
    },
    1,
    TODAY,
    { requireEmail: true, ticketTypes: [] },
  );
  console.log("✅ Scenario 1 (lap child, no seat):");
  console.log("  passengerType:", lapChild.passengerType); // CHILD_UNDER_6
  console.log("  seatRequired:", lapChild.seatRequired); // false
  console.log("  discountPercentage:", lapChild.discountPercentage); // 100 (free)
} catch (err) {
  console.error("❌ Scenario 1 FAILED:", err.message);
}

// Scenario 2: Child under 6 with a seat (pays as CHILD)
try {
  const seatedChild = normalizePassenger(
    {
      fullName: "Be Binh",
      dateOfBirth: DOB_UNDER_6,
      passengerType: "CHILD",
      seatRequired: true,
      nationalIdType: "",
      nationalId: "",
      phoneNumber: "",
      email: "",
    },
    1,
    TODAY,
    { requireEmail: true, ticketTypes: [] },
  );
  console.log("✅ Scenario 2 (child under 6 with seat):");
  console.log("  passengerType:", seatedChild.passengerType); // CHILD
  console.log("  seatRequired:", seatedChild.seatRequired); // true
  console.log("  discountPercentage:", seatedChild.discountPercentage); // 25
} catch (err) {
  console.error("❌ Scenario 2 FAILED:", err.message);
}

// Scenario 3: normalizeQuotePassenger for lap child
try {
  const lapChildQuote = normalizeQuotePassenger(
    {
      dateOfBirth: DOB_UNDER_6,
      passengerType: "CHILD",
      seatRequired: false,
    },
    1,
    TODAY,
    [],
  );
  console.log("✅ Scenario 3 (quote: lap child, no seat):");
  console.log("  passengerType:", lapChildQuote.passengerType); // CHILD_UNDER_6
  console.log("  seatRequired:", lapChildQuote.seatRequired); // false
} catch (err) {
  console.error("❌ Scenario 3 FAILED:", err.message);
}

// Scenario 4: normalizeQuotePassenger for seated under-6 child
try {
  const seatedChildQuote = normalizeQuotePassenger(
    {
      dateOfBirth: DOB_UNDER_6,
      passengerType: "CHILD_UNDER_6", // client might send this
      seatRequired: true,
    },
    1,
    TODAY,
    [],
  );
  console.log("✅ Scenario 4 (quote: seated child under 6):");
  console.log("  passengerType:", seatedChildQuote.passengerType); // CHILD
  console.log("  seatRequired:", seatedChildQuote.seatRequired); // true
} catch (err) {
  console.error("❌ Scenario 4 FAILED:", err.message);
}

// Scenario 5: lap child with no dateOfBirth should throw
try {
  const noDateChild = normalizePassenger(
    {
      fullName: "Be C",
      dateOfBirth: "",
      passengerType: "CHILD",
      seatRequired: false,
      nationalIdType: "",
      nationalId: "",
      phoneNumber: "",
      email: "",
    },
    1,
    TODAY,
    { requireEmail: true, ticketTypes: [] },
  );
  console.error(
    "❌ Scenario 5 SHOULD HAVE THROWN but got:",
    noDateChild.passengerType,
  );
} catch (err) {
  console.log(
    "✅ Scenario 5 (lap child, no dateOfBirth throws correctly):",
    err.message,
  );
}
