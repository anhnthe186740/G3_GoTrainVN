import assert from "node:assert/strict";
import test from "node:test";
import { validatePassengerBusinessRules } from "../src/services/bookingCheckout.service.js";

test("validatePassengerBusinessRules - allows adult alone", () => {
  const passengers = [
    {
      fullName: "Nguyên Văn A",
      ageAtDeparture: 30,
      seatRequired: true,
      passengerType: "ADULT",
    },
  ];
  assert.doesNotThrow(() => validatePassengerBusinessRules(passengers));
});

test("validatePassengerBusinessRules - rejects unaccompanied child under 10", () => {
  const passengers = [
    {
      fullName: "Trẻ Em A",
      ageAtDeparture: 7,
      seatRequired: true,
      passengerType: "CHILD",
    },
  ];
  assert.throws(
    () => validatePassengerBusinessRules(passengers),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Trẻ em dưới 10 tuổi/);
      return true;
    },
  );
});

test("validatePassengerBusinessRules - rejects child when age is missing but passengerType is CHILD", () => {
  const passengers = [
    {
      fullName: "Trẻ Em B",
      ageAtDeparture: null,
      seatRequired: true,
      passengerType: "CHILD",
    },
  ];
  assert.throws(
    () => validatePassengerBusinessRules(passengers),
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Trẻ em dưới 10 tuổi/);
      return true;
    },
  );
});

test("validatePassengerBusinessRules - allows child with adult companion", () => {
  const passengers = [
    {
      fullName: "Người Lớn A",
      ageAtDeparture: 35,
      seatRequired: true,
      passengerType: "ADULT",
    },
    {
      fullName: "Trẻ Em A",
      ageAtDeparture: 7,
      seatRequired: true,
      passengerType: "CHILD",
    },
  ];
  assert.doesNotThrow(() => validatePassengerBusinessRules(passengers));
});
