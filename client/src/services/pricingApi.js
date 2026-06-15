import { api } from "./api";

export const pricingApi = {
  getContext: () => api.get("/pricing/context"),
  getConfiguration: (params) => api.get("/pricing/configuration", { params }),
  savePolicy: (payload) => api.post("/pricing/policies", payload),
  setPolicyActive: (policyCode, active) =>
    api.patch(`/pricing/policies/${policyCode}/active`, { active }),
};
