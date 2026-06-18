import { searchStaffWorkspace } from "../services/staffSearch.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const globalStaffSearch = asyncHandler(async (req, res) => {
  const result = await searchStaffWorkspace(req.query.q);
  res.json(result);
});
