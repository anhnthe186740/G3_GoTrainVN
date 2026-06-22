import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePassengerAge,
  normalizeQuotePassenger,
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

test("BR-08 discount policy is applied through normalizePassenger", () => {
  // Trẻ dưới 6 tuổi: miễn phí 100%, không cần ghế riêng
  const under6 = normalizePassenger(
    { fullName: "Be Ut", dateOfBirth: "2021-01-01", seatRequired: false },
    0,
    TODAY,
  );
  assert.equal(under6.discountPercentage, 100);
  assert.equal(under6.discountReason, "CHILD_UNDER_6");
  assert.equal(under6.seatRequired, false);

  // Trẻ 6–9 tuổi: giảm 25%
  const child = normalizePassenger(
    { fullName: "Be Lon", dateOfBirth: "2019-01-01" },
    0,
    TODAY,
  );
  assert.equal(child.discountPercentage, 25);
  assert.equal(child.discountReason, "CHILD");
  assert.equal(child.seatRequired, true);

  // Người cao tuổi từ 60 tuổi: giảm 15%
  const senior = normalizePassenger(
    adult({ dateOfBirth: "1966-01-01" }),
    0,
    TODAY,
  );
  assert.equal(senior.discountPercentage, 15);
  assert.equal(senior.passengerType, "SENIOR");

  // Sinh viên: giảm 10%
  const student = normalizePassenger(
    adult({ dateOfBirth: "2005-09-17", passengerType: "STUDENT" }),
    0,
    TODAY,
  );
  assert.equal(student.discountPercentage, 10);
  assert.equal(student.passengerType, "STUDENT");
});

test("children under 6 are automatically assigned seatRequired=false via CHILD_UNDER_6 ticket type", () => {
  // Không cần seatRequired: false rõ ràng — hệ thống tự nhận dạng qua ticketType
  const passenger = normalizePassenger(
    {
      fullName: "Be Nho",
      dateOfBirth: "2022-01-01",
      passengerType: "CHILD",
    },
    0,
    TODAY,
  );
  assert.equal(passenger.passengerType, "CHILD_UNDER_6");
  assert.equal(passenger.seatRequired, false);
  assert.equal(passenger.discountPercentage, 100);
  assert.equal(passenger.discountReason, "CHILD_UNDER_6");

  // Kết quả giống nhau dù có hay không có seatRequired: false
  const passengerExplicit = normalizePassenger(
    {
      fullName: "Be Nho",
      dateOfBirth: "2022-01-01",
      passengerType: "CHILD",
      seatRequired: false,
    },
    0,
    TODAY,
  );
  assert.equal(passengerExplicit.seatRequired, false);
  assert.equal(passengerExplicit.discountReason, "CHILD_UNDER_6");
});

test("quote with unknown age keeps requested type without discount (null < 10 coercion guard)", () => {
  // Người dùng chưa nhập ngày sinh → age = null.
  // null < 10 = true trong JS vì null bị ép về 0 → nếu không guard sẽ tính nhầm CHILD 25%.
  const passenger = normalizeQuotePassenger(
    { passengerType: "ADULT", dateOfBirth: "" },
    0,
    TODAY,
  );
  assert.equal(passenger.passengerType, "ADULT");
  assert.equal(passenger.discountPercentage, 0);

  const student = normalizeQuotePassenger(
    { passengerType: "STUDENT", dateOfBirth: "" },
    0,
    TODAY,
  );
  assert.equal(student.passengerType, "STUDENT");
  assert.equal(student.discountPercentage, 10);
});

test("quote rejects shared-seat passengers who are not under 6", () => {
  assert.throws(
    () =>
      normalizeQuotePassenger(
        {
          dateOfBirth: "2005-09-17",
          passengerType: "ADULT",
          seatRequired: false,
        },
        0,
        TODAY,
      ),
    /chỉ trẻ dưới 6 tuổi/,
  );
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

test("each seat can be shared with only one child under 6", () => {
  const lapChild = (fullName) =>
    normalizePassenger(
      {
        fullName,
        dateOfBirth: "2022-01-01",
        passengerType: "CHILD",
        seatRequired: false,
      },
      0,
      TODAY,
    );
  const seatedChild = normalizePassenger(
    {
      fullName: "Be Co Ghe",
      dateOfBirth: "2018-01-01",
      passengerType: "CHILD",
    },
    0,
    TODAY,
  );

  assert.throws(
    () =>
      validatePassengerBusinessRules([
        normalizePassenger(adult(), 0, TODAY),
        lapChild("Be Mot"),
        lapChild("Be Hai"),
      ]),
    /Mỗi ghế chỉ được xếp tối đa/,
  );

  assert.doesNotThrow(() =>
    validatePassengerBusinessRules([
      normalizePassenger(adult(), 0, TODAY),
      seatedChild,
      lapChild("Be Mot"),
      lapChild("Be Hai"),
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
