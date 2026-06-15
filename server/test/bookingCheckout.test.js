import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePassengerAge,
  normalizePassenger,
  validateAccountHolderSelection,
  validatePassengerBusinessRules,
} from "../src/services/bookingCheckout.service.js";

const TODAY = new Date("2026-06-16T12:00:00+07:00");

function adult(overrides = {}) {
  return {
    fullName: "Nguyen Van A",
    dateOfBirth: "1990-01-01",
    passengerType: "ADULT",
    nationalIdType: "CCCD",
    nationalId: "012345678901",
    phoneNumber: "0912345678",
    email: "adult@example.com",
    ...overrides,
  };
}

test("age calculation respects whether the birthday has passed", () => {
  assert.equal(calculatePassengerAge("2016-06-15", TODAY), 10);
  assert.equal(calculatePassengerAge("2016-06-17", TODAY), 9);
});

test("passengers under 10 are normalized to CHILD with nullable identity fields", () => {
  const passenger = normalizePassenger(
    adult({
      fullName: "Be Nguyen",
      dateOfBirth: "2020-01-01",
      passengerType: "ADULT",
    }),
    0,
    TODAY,
  );

  assert.equal(passenger.passengerType, "CHILD");
  assert.equal(passenger.nationalId, null);
  assert.equal(passenger.nationalIdType, null);
  assert.equal(passenger.phoneNumber, null);
  assert.equal(passenger.email, null);
});

test("children only require full name and date of birth", () => {
  const passenger = normalizePassenger(
    {
      fullName: "Be Nguyen",
      dateOfBirth: "2020-01-01",
    },
    0,
    TODAY,
  );
  assert.equal(passenger.passengerType, "CHILD");
  assert.equal(passenger.nationalId, null);
  assert.equal(passenger.phoneNumber, null);
});

test("age based categories normalize senior while preserving valid student choice", () => {
  assert.equal(
    normalizePassenger(
      adult({ dateOfBirth: "1960-01-01", passengerType: "ADULT" }),
      0,
      TODAY,
    ).passengerType,
    "SENIOR",
  );
  assert.equal(
    normalizePassenger(
      adult({ dateOfBirth: "2005-01-01", passengerType: "STUDENT" }),
      0,
      TODAY,
    ).passengerType,
    "STUDENT",
  );
});

test("BR-07 requires a companion when the booking contains children", () => {
  const child = normalizePassenger(
    {
      fullName: "Be Nguyen",
      dateOfBirth: "2020-01-01",
      passengerType: "CHILD",
    },
    0,
    TODAY,
  );
  assert.throws(() => validatePassengerBusinessRules([child]), /phải đi cùng/);
  assert.doesNotThrow(() =>
    validatePassengerBusinessRules([
      child,
      normalizePassenger(adult(), 1, TODAY),
    ]),
  );
});

test("BR-06 rejects more than four passengers", () => {
  assert.throws(
    () =>
      validatePassengerBusinessRules([
        adult(),
        adult(),
        adult(),
        adult(),
        adult(),
      ]),
    /tối đa 4/,
  );
});

test("identity documents must be unique inside one booking session", () => {
  assert.throws(
    () =>
      validatePassengerBusinessRules([
        normalizePassenger(adult(), 0, TODAY),
        normalizePassenger(adult({ fullName: "Nguyen Van B" }), 1, TODAY),
      ]),
    /bị trùng/,
  );
  assert.doesNotThrow(() =>
    validatePassengerBusinessRules([
      normalizePassenger(adult(), 0, TODAY),
      normalizePassenger(
        adult({
          fullName: "Nguyen Van B",
          nationalId: "012345678902",
          email: "second@example.com",
        }),
        1,
        TODAY,
      ),
    ]),
  );
});

test("only one ticket can be assigned to the account holder", () => {
  assert.throws(
    () =>
      validateAccountHolderSelection(
        [{ isAccountHolder: true }, { isAccountHolder: true }],
        { userId: "user-1" },
      ),
    /chỉ được chọn cho một vé/,
  );
  assert.throws(
    () =>
      validateAccountHolderSelection([{ isAccountHolder: true }], {
        userId: null,
      }),
    /Khách vãng lai/,
  );
  assert.doesNotThrow(() =>
    validateAccountHolderSelection(
      [{ isAccountHolder: true }, { isAccountHolder: false }],
      { userId: "user-1" },
    ),
  );
});
