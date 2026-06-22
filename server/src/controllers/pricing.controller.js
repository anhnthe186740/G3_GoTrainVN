import { asyncHandler } from "../utils/asyncHandler.js";
import * as pricingService from "../services/pricing.service.js";

function adminContext(req) {
  return {
    adminId: req.user.id,
    ipAddress: req.ip,
  };
}

export const getPricingContext = asyncHandler(async (_req, res) => {
  const context = await pricingService.getPricingContext();
  res.json(context);
});

export const getPublicTicketTypes = asyncHandler(async (_req, res) => {
  const ticketTypes = await pricingService.getPublicTicketTypes();
  res.json({ ticketTypes });
});

export const getTicketTypes = asyncHandler(async (req, res) => {
  const ticketTypes = await pricingService.getTicketTypes({
    includeInactive: req.query.includeInactive === "true",
  });
  res.json({ ticketTypes });
});

export const createTicketType = asyncHandler(async (req, res) => {
  const ticketType = await pricingService.createTicketType(
    req.body,
    adminContext(req),
  );
  res.status(201).json({
    message: "Đã tạo loại vé.",
    ticketType,
  });
});

export const updateTicketType = asyncHandler(async (req, res) => {
  const ticketType = await pricingService.updateTicketType(
    req.params.id,
    req.body,
    adminContext(req),
  );
  res.json({
    message: "Đã cập nhật loại vé.",
    ticketType,
  });
});

export const setTicketTypeActive = asyncHandler(async (req, res) => {
  const ticketType = await pricingService.setTicketTypeActive(
    req.params.id,
    req.body.active,
    adminContext(req),
  );
  res.json({
    message: ticketType.active
      ? "Đã kích hoạt loại vé."
      : "Đã tạm dừng loại vé.",
    ticketType,
  });
});

export const getPricingConfiguration = asyncHandler(async (req, res) => {
  const configuration = await pricingService.getConfiguration({
    scopeType: req.query.scopeType || "SYSTEM",
    scopeId: req.query.scopeId,
    at: req.query.at,
  });
  res.json(configuration);
});

export const savePricingPolicy = asyncHandler(async (req, res) => {
  const policy = await pricingService.savePolicy(req.body, adminContext(req));
  res.status(req.body.policyCode ? 200 : 201).json({
    message: req.body.policyCode
      ? "Đã cập nhật chính sách giá."
      : "Đã tạo và kích hoạt chính sách giá.",
    policy,
  });
});

export const setPricingPolicyActive = asyncHandler(async (req, res) => {
  const policy = await pricingService.setPolicyActive(
    req.params.policyCode,
    req.body.active,
    adminContext(req),
  );
  res.json({
    message: policy.active
      ? "Đã kích hoạt chính sách."
      : "Đã tạm dừng chính sách.",
    policy,
  });
});

export const previewFare = asyncHandler(async (req, res) => {
  const result = pricingService.calculateFare(
    req.body.rule,
    req.body.distance,
    req.body.taxPercentage,
  );
  res.json({ preview: result });
});
