import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_PAYOS_BASE_URL = "https://api-merchant.payos.vn";

function httpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function requirePayosConfig() {
  const config = {
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
    baseUrl: process.env.PAYOS_BASE_URL || DEFAULT_PAYOS_BASE_URL,
  };
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "baseUrl" && !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw httpError(503, "PayOS chua duoc cau hinh day du tren server.", {
      missing,
    });
  }
  return config;
}

function sortObjectByKey(object) {
  return Object.keys(object || {})
    .sort()
    .reduce((result, key) => {
      result[key] = object[key];
      return result;
    }, {});
}

function stringifySignatureValue(value) {
  if ([null, undefined, "undefined", "null"].includes(value)) return "";
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((item) => sortObjectByKey(item)));
  }
  return String(value);
}

export function toPayosSignatureData(data) {
  return Object.entries(sortObjectByKey(data))
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${stringifySignatureValue(value)}`)
    .join("&");
}

export function createPayosSignature(data, checksumKey) {
  return createHmac("sha256", checksumKey)
    .update(toPayosSignatureData(data))
    .digest("hex");
}

export function verifyPayosSignature(data, signature) {
  const { checksumKey } = requirePayosConfig();
  if (!signature || typeof signature !== "string") return false;
  const expected = createPayosSignature(data, checksumKey);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function frontendUrl(path) {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return new URL(path, clientUrl).toString();
}

export function buildPayosPaymentPayload({
  orderCode,
  amount,
  description,
  expiresAt,
  buyer,
}) {
  const returnUrl =
    process.env.PAYOS_RETURN_URL || frontendUrl("/tra-cuu-ve?payment=success");
  const cancelUrl =
    process.env.PAYOS_CANCEL_URL || frontendUrl("/?payment=cancelled");
  const payload = {
    orderCode,
    amount: Math.round(amount),
    description,
    buyerName: buyer?.name || undefined,
    buyerEmail: buyer?.email || undefined,
    buyerPhone: buyer?.phone || undefined,
    items: [
      {
        name: "Ve tau GoTrainVN",
        quantity: 1,
        price: Math.round(amount),
      },
    ],
    cancelUrl,
    returnUrl,
    expiredAt: expiresAt
      ? Math.floor(new Date(expiresAt).getTime() / 1000)
      : undefined,
  };
  payload.signature = createPayosSignature(
    {
      amount: payload.amount,
      cancelUrl: payload.cancelUrl,
      description: payload.description,
      orderCode: payload.orderCode,
      returnUrl: payload.returnUrl,
    },
    requirePayosConfig().checksumKey,
  );
  return payload;
}

export async function createPayosPaymentRequest(paymentInput) {
  const config = requirePayosConfig();
  const payload = buildPayosPaymentPayload(paymentInput);
  const response = await fetch(`${config.baseUrl}/v2/payment-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": config.clientId,
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.code !== "00") {
    throw httpError(
      response.status >= 400 ? response.status : 502,
      body?.desc || "Khong the tao link thanh toan PayOS.",
      body,
    );
  }
  return body.data;
}

export async function getPayosPaymentRequest(id) {
  const config = requirePayosConfig();
  const response = await fetch(
    `${config.baseUrl}/v2/payment-requests/${encodeURIComponent(id)}`,
    {
      headers: {
        "x-client-id": config.clientId,
        "x-api-key": config.apiKey,
      },
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.code !== "00") {
    throw httpError(
      response.status >= 400 ? response.status : 502,
      body?.desc || "Khong the lay thong tin thanh toan PayOS.",
      body,
    );
  }
  return body.data;
}
