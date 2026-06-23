import express from "express";
import bcrypt from "bcryptjs";
import Registration from "../models/Registration.js";
import Booking from "../models/Booking.js";
import AdminUser from "../models/AdminUser.js";
import ContainerType from "../models/ContainerType.js";
import { attachRegistrationCompleteness, buildRegistrationRecordChecklist } from "../utils/registrationValidation.js";
import { emitRealtimeUpdate } from "../utils/realtime.js";
import {
  getEffectiveModuleAccess,
  isSystemSuperAdminRecord,
  normalizeEmail,
  normalizeUsername,
  requireAdminSession,
  requireModuleAccess,
  requireSuperAdmin,
  sanitizeModuleAccess,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAdminSession);

const validateAdminAccountPayload = (body = {}) => {
  const firstName = (body.firstName || "").trim();
  const middleName = (body.middleName || "").trim();
  const lastName = (body.lastName || "").trim();
  const phoneNumber = (body.phoneNumber || "").trim();
  const email = normalizeEmail(body.email || "");
  const username = normalizeUsername(body.username || "");
  const password = body.password || "";
  const role = body.role === "super_admin" ? "super_admin" : "admin";
  const moduleAccess = role === "super_admin" ? [] : sanitizeModuleAccess(body.moduleAccess || []);

  if (!firstName) return { error: "First name is required" };
  if (!lastName) return { error: "Last name is required" };
  if (!phoneNumber) return { error: "Phone number is required" };
  if (!email || !email.includes("@")) return { error: "Valid email address is required" };
  if (!/^[a-z0-9_-]{4,32}$/.test(username)) {
    return { error: "Username must be 4 to 32 characters using letters, numbers, underscore, or dash only" };
  }
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  return {
    value: {
      firstName,
      middleName,
      lastName,
      phoneNumber,
      email,
      username,
      password,
      role,
      moduleAccess,
    },
  };
};


const cleanContainerType = (containerType) => {
  const item = containerType.toObject ? containerType.toObject() : containerType;
  return {
    _id: item._id,
    label: item.label,
    value: item.value,
    description: item.description,
    displayOrder: item.displayOrder,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const validateContainerTypePayload = (body = {}, partial = false) => {
  const label = typeof body.label === "string" ? body.label.trim() : undefined;
  const value = typeof body.value === "string" ? body.value.trim() : undefined;
  const description = typeof body.description === "string" ? body.description.trim() : undefined;
  const displayOrder = body.displayOrder === "" || body.displayOrder === undefined ? undefined : Number(body.displayOrder);
  const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

  if (!partial || label !== undefined) {
    if (!label) return { error: "Container label is required" };
  }

  if (!partial || value !== undefined) {
    if (!value) return { error: "Container value is required" };
    if (!/^[a-zA-Z0-9 "'\/-]{2,50}$/.test(value)) {
      return { error: "Container value can only use letters, numbers, spaces, quote marks, slash, or dash" };
    }
  }

  if (displayOrder !== undefined && Number.isNaN(displayOrder)) {
    return { error: "Display order must be a number" };
  }

  const valueObject = {};
  if (label !== undefined) valueObject.label = label;
  if (value !== undefined) valueObject.value = value;
  if (description !== undefined) valueObject.description = description;
  if (displayOrder !== undefined) valueObject.displayOrder = displayOrder;
  if (isActive !== undefined) valueObject.isActive = isActive;

  return { value: valueObject };
};

const cleanAdminUser = (adminUser) => {
  const item = adminUser.toObject ? adminUser.toObject() : adminUser;
  return {
    _id: item._id,
    email: item.email,
    username: item.username,
    isSystemSuperAdmin: isSystemSuperAdminRecord(item),
    firstName: item.firstName,
    middleName: item.middleName,
    lastName: item.lastName,
    phoneNumber: item.phoneNumber,
    role: item.role,
    moduleAccess: item.moduleAccess || [],
    effectiveModuleAccess: getEffectiveModuleAccess(item),
    status: item.status,
    lastLoginAt: item.lastLoginAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

router.get("/users", requireSuperAdmin, async (req, res, next) => {
  try {
    const users = await AdminUser.find().sort({ createdAt: -1 });
    res.json({ users: users.map(cleanAdminUser) });
  } catch (error) {
    next(error);
  }
});

router.post("/users", requireSuperAdmin, async (req, res, next) => {
  try {
    const validated = validateAdminAccountPayload(req.body);

    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }

    const {
      firstName,
      middleName,
      lastName,
      phoneNumber,
      email,
      username,
      password,
      role,
      moduleAccess,
    } = validated.value;

    const clientRegistration = await Registration.findOne({ email }).select("companyName status");

    if (clientRegistration) {
      return res.status(409).json({
        message: "This email is already registered as a client account. Use a different admin email.",
      });
    }

    const existingAdmin = await AdminUser.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      return res.status(409).json({ message: "This admin email or username already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const adminUser = await AdminUser.create({
      email,
      username,
      passwordHash,
      firstName,
      middleName,
      lastName,
      phoneNumber,
      role,
      moduleAccess,
      status: "active",
      createdByAdminId: req.adminUser._id,
    });

    emitRealtimeUpdate(req, "admin-users:changed", { action: "created", adminUserId: String(adminUser._id) });

    return res.status(201).json({
      message: "Admin account created. The new admin can now sign in on /admin.",
      user: cleanAdminUser(adminUser),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This admin email or username already exists." });
    }

    next(error);
  }
});

router.patch("/users/:id/role", requireSuperAdmin, async (req, res, next) => {
  try {
    const role = req.body.role === "super_admin" ? "super_admin" : "admin";
    const adminUser = await AdminUser.findById(req.params.id);

    if (!adminUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    if (String(adminUser._id) === req.adminUserId && role !== "super_admin") {
      return res.status(400).json({ message: "You cannot remove your own super admin role." });
    }

    if (isSystemSuperAdminRecord(adminUser) && role !== "super_admin") {
      return res.status(400).json({ message: "The system super admin role cannot be removed." });
    }

    adminUser.role = role;
    if (role === "super_admin") {
      adminUser.moduleAccess = [];
    }
    await adminUser.save();

    emitRealtimeUpdate(req, "admin-users:changed", { action: "updated", adminUserId: String(adminUser._id) });

    res.json({ user: cleanAdminUser(adminUser) });
  } catch (error) {
    next(error);
  }
});


router.patch("/users/:id/access", requireSuperAdmin, async (req, res, next) => {
  try {
    const adminUser = await AdminUser.findById(req.params.id);

    if (!adminUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    if (isSystemSuperAdminRecord(adminUser)) {
      return res.status(400).json({ message: "The system super admin module access cannot be changed." });
    }

    if (adminUser.role === "super_admin") {
      return res.status(400).json({ message: "Super admin users already have full module access." });
    }

    adminUser.moduleAccess = sanitizeModuleAccess(req.body.moduleAccess || []);
    await adminUser.save();

    emitRealtimeUpdate(req, "admin-users:changed", { action: "access_updated", adminUserId: String(adminUser._id) });

    res.json({ user: cleanAdminUser(adminUser) });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/status", requireSuperAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid admin status" });
    }

    const adminUser = await AdminUser.findById(req.params.id);

    if (!adminUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    if (String(adminUser._id) === req.adminUserId && status === "disabled") {
      return res.status(400).json({ message: "You cannot disable your own admin account." });
    }

    if (isSystemSuperAdminRecord(adminUser) && status !== "active") {
      return res.status(400).json({ message: "The system super admin must stay active." });
    }

    adminUser.status = status;
    await adminUser.save();

    emitRealtimeUpdate(req, "admin-users:changed", { action: "status_updated", adminUserId: String(adminUser._id) });

    res.json({ user: cleanAdminUser(adminUser) });
  } catch (error) {
    next(error);
  }
});


router.get("/container-types", requireModuleAccess("containers"), async (req, res, next) => {
  try {
    const containerTypes = await ContainerType.find().sort({ displayOrder: 1, label: 1 });
    res.json({ containerTypes: containerTypes.map(cleanContainerType) });
  } catch (error) {
    next(error);
  }
});

router.post("/container-types", requireModuleAccess("containers"), async (req, res, next) => {
  try {
    const validated = validateContainerTypePayload(req.body);

    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }

    const existing = await ContainerType.findOne({ value: validated.value.value });

    if (existing) {
      return res.status(409).json({ message: "This container size/type already exists." });
    }

    const containerType = await ContainerType.create({
      ...validated.value,
      createdByAdminId: req.adminUserId,
      updatedByAdminId: req.adminUserId,
    });

    emitRealtimeUpdate(req, "container-types:changed", { action: "created", containerTypeId: String(containerType._id) });

    res.status(201).json({
      message: "Container size/type created",
      containerType: cleanContainerType(containerType),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This container size/type already exists." });
    }

    next(error);
  }
});

router.patch("/container-types/:id", requireModuleAccess("containers"), async (req, res, next) => {
  try {
    const validated = validateContainerTypePayload(req.body, true);

    if (validated.error) {
      return res.status(400).json({ message: validated.error });
    }

    const containerType = await ContainerType.findById(req.params.id);

    if (!containerType) {
      return res.status(404).json({ message: "Container size/type not found" });
    }

    if (validated.value.value && validated.value.value !== containerType.value) {
      const existing = await ContainerType.findOne({ value: validated.value.value, _id: { $ne: containerType._id } });

      if (existing) {
        return res.status(409).json({ message: "This container size/type already exists." });
      }
    }

    Object.assign(containerType, validated.value, { updatedByAdminId: req.adminUserId });
    await containerType.save();

    emitRealtimeUpdate(req, "container-types:changed", { action: "updated", containerTypeId: String(containerType._id) });

    res.json({
      message: "Container size/type updated",
      containerType: cleanContainerType(containerType),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This container size/type already exists." });
    }

    next(error);
  }
});

router.get("/documents", requireModuleAccess("documents"), async (req, res, next) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
    res.json({ registrations: registrations.map(attachRegistrationCompleteness) });
  } catch (error) {
    next(error);
  }
});

router.get("/registrations", requireModuleAccess("registrations"), async (req, res, next) => {
  try {
    const registrations = await Registration.find().sort({ createdAt: -1 });
    res.json({ registrations: registrations.map(attachRegistrationCompleteness) });
  } catch (error) {
    next(error);
  }
});

router.patch("/registrations/:id/status", requireModuleAccess("registrations"), async (req, res, next) => {
  try {
    const { status, adminRemarks } = req.body;

    if (!["pending", "verified", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    if (status === "verified") {
      const completeness = buildRegistrationRecordChecklist(registration);

      if (!completeness.isComplete) {
        return res.status(400).json({
          message: `Cannot verify this client yet. Missing: ${completeness.missingFields.join(", ")}`,
          missingFields: completeness.missingFields,
          verificationChecklist: completeness.checklist,
        });
      }
    }

    registration.status = status;
    registration.adminRemarks = adminRemarks || "";
    registration.verifiedAt = status === "verified" ? new Date() : null;
    registration.reviewedByAdminId = req.adminUserId;
    registration.reviewedAt = new Date();
    await registration.save();

    emitRealtimeUpdate(req, "registrations:changed", { action: "status_updated", registrationId: String(registration._id), status });

    res.json({ registration: attachRegistrationCompleteness(registration) });
  } catch (error) {
    next(error);
  }
});

router.get("/bookings", requireModuleAccess("bookings"), async (req, res, next) => {
  try {
    const bookings = await Booking.find().populate("registrationId").sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

router.patch("/bookings/:id/status", requireModuleAccess("bookings"), async (req, res, next) => {
  try {
    const { status, adminRemarks } = req.body;

    if (!["submitted", "approved", "rejected", "no show"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, adminRemarks: adminRemarks || "" },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    emitRealtimeUpdate(req, "bookings:changed", { action: "status_updated", bookingId: String(booking._id), status });

    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

export default router;
