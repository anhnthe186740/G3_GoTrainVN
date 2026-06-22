import { api } from "./api";

export const pricingApi = {
  getContext: () => api.get("/pricing/context"),
  getConfiguration: (params) => api.get("/pricing/configuration", { params }),
  getPublicTicketTypes: () => api.get("/pricing/ticket-types/public"),
  getTicketTypes: () =>
    api.get("/pricing/ticket-types", {
      params: { includeInactive: true },
    }),
  createTicketType: (payload) => api.post("/pricing/ticket-types", payload),
  updateTicketType: (id, payload) =>
    api.patch(`/pricing/ticket-types/${id}`, payload),
  setTicketTypeActive: (id, active) =>
    api.patch(`/pricing/ticket-types/${id}/active`, { active }),
  savePolicy: (payload) => api.post("/pricing/policies", payload),
  setPolicyActive: (policyCode, active) =>
    api.patch(`/pricing/policies/${policyCode}/active`, { active }),
};
