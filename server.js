import "dotenv/config";
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import connectDB from "./src/config/db.js";
import registrationRoutes from "./src/routes/registration.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import containerRoutes from "./src/routes/container.routes.js";
import { ensureDefaultContainerTypes } from "./src/services/seedContainerTypes.js";
import { ensureSeedSuperAdmin } from "./src/services/seedSuperAdmin.js";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CLIENT_URL,
    credentials: true,
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Realtime client connected: ${socket.id}`);

  socket.emit("realtime:ready", {
    message: "Realtime updates connected",
    timestamp: new Date().toISOString(),
  });

  socket.on("disconnect", () => {
    console.log(`Realtime client disconnected: ${socket.id}`);
  });
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await connectDB();
await ensureSeedSuperAdmin();
await ensureDefaultContainerTypes();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(clerkMiddleware());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Mega Port Terminal API running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/container-types", containerRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Realtime websocket server ready");
});
