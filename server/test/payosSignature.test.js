import test from "node:test";
import assert from "node:assert/strict";
import {
  createPayosSignature,
  toPayosSignatureData,
} from "../src/services/payos.service.js";

const CHECKSUM_KEY =
  "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";

const WEBHOOK_DATA = {
  orderCode: 123,
  amount: 3000,
  description: "VQRIO123",
  accountNumber: "12345678",
  reference: "TF230204212323",
  transactionDateTime: "2023-02-04 18:25:00",
  currency: "VND",
  paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
  code: "00",
  desc: "Thanh cong",
  counterAccountBankId: "",
  counterAccountBankName: "",
  counterAccountName: "",
  counterAccountNumber: "",
  virtualAccountName: "",
  virtualAccountNumber: "",
};

test("PayOS signature data is sorted alphabetically", () => {
  assert.equal(
    toPayosSignatureData(WEBHOOK_DATA).startsWith("accountNumber=12345678"),
    true,
  );
  assert.match(toPayosSignatureData(WEBHOOK_DATA), /&orderCode=123&/);
});

test("PayOS HMAC SHA-256 signature is deterministic", () => {
  assert.equal(
    createPayosSignature(WEBHOOK_DATA, CHECKSUM_KEY),
    createPayosSignature({ ...WEBHOOK_DATA }, CHECKSUM_KEY),
  );
});
