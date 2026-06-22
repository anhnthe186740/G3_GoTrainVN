import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRefundMethod,
  refundPolicy,
} from "../src/services/bookingCancellation.service.js";

const NOW = new Date("2026-06-21T12:00:00+07:00");

test("refund policy rejects departed and near-departure trains", () => {
  assert.equal(refundPolicy("2026-06-21T11:00:00+07:00", NOW).allowed, false);
  assert.equal(refundPolicy("2026-06-21T15:00:00+07:00", NOW).allowed, false);
});

test("refund policy applies 50 percent and 80 percent windows", () => {
  const sameDay = refundPolicy("2026-06-21T18:00:00+07:00", NOW);
  assert.equal(sameDay.allowed, true);
  assert.equal(sameDay.rate, 0.5);

  const nextDay = refundPolicy("2026-06-23T12:00:00+07:00", NOW);
  assert.equal(nextDay.allowed, true);
  assert.equal(nextDay.rate, 0.8);
});

test("refund method normalizes bank alias and rejects unsupported values", () => {
  assert.equal(normalizeRefundMethod("wallet"), "WALLET");
  assert.equal(normalizeRefundMethod("BANK"), "BANK_TRANSFER");
  assert.throws(() => normalizeRefundMethod("CASH"), /không hợp lệ/i);
});
