import { asyncHandler } from "../utils/asyncHandler.js";
import {
  confirmSeatSelection,
  getSeatMap,
  getSession,
  releaseSession,
} from "../services/seatSelection.service.js";
import { emitSeatState } from "../realtime/seatRealtime.js";

export const confirmSeatHolds = asyncHandler(async (req, res) => {
  const { session, releasedHolds } = await confirmSeatSelection(
    req.bookingIdentity,
    req.body,
  );
  for (const hold of releasedHolds) {
    emitSeatState(hold.scheduleId, {
      seatId: hold.seatId,
      state: "AVAILABLE",
    });
  }
  for (const hold of session.holds) {
    emitSeatState(hold.scheduleId, {
      seatId: hold.seatId,
      state: "LOCKED",
    });
  }
  res.status(201).json({ session });
});

export const getSeatSession = asyncHandler(async (req, res) => {
  const session = await getSession(req.bookingIdentity, req.params.sessionId);
  res.json({ session });
});

export const getScheduleSeatMap = asyncHandler(async (req, res) => {
  const seatMap = await getSeatMap({
    identity: req.bookingIdentity,
    sessionId: req.query.sessionId,
    scheduleId: req.params.scheduleId,
    fromStationId: req.query.fromStationId,
    toStationId: req.query.toStationId,
  });
  res.json(seatMap);
});

export const deleteSeatSession = asyncHandler(async (req, res) => {
  const released = await releaseSession(
    req.bookingIdentity,
    req.params.sessionId,
  );
  for (const hold of released.holds) {
    emitSeatState(hold.scheduleId, {
      seatId: hold.seatId,
      state: "AVAILABLE",
    });
  }
  res.json({ message: "Đã giải phóng các ghế đang giữ." });
});
