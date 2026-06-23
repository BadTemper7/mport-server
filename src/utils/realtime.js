export const emitRealtimeUpdate = (req, eventName, payload = {}) => {
  const io = req.app.get("io");

  if (!io) return;

  io.emit(eventName, {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  io.emit("dashboard:changed", {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  });
};
