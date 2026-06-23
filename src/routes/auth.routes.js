import express from "express";
import bcrypt from "bcryptjs";
import AdminUser from "../models/AdminUser.js";
import {
  getEffectiveModuleAccess,
  isSystemSuperAdminRecord,
  normalizeEmail,
  normalizeUsername,
  requireAdminSession,
  requireUser,
  resolveSignedInAccount,
  signAdminToken,
} from "../middleware/auth.js";

const router = express.Router();

const cleanAdminUser = (adminUser) => {
  const item = adminUser.toObject ? adminUser.toObject() : adminUser;

  return {
    _id: item._id,
    email: item.email,
    username: item.username,
    firstName: item.firstName,
    middleName: item.middleName,
    lastName: item.lastName,
    phoneNumber: item.phoneNumber,
    role: item.role,
    status: item.status,
    isSystemSuperAdmin: isSystemSuperAdminRecord(item),
    moduleAccess: item.moduleAccess || [],
    effectiveModuleAccess: getEffectiveModuleAccess(item),
    lastLoginAt: item.lastLoginAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

router.get("/bootstrap-status", async (req, res, next) => {
  try {
    const hasSuperAdmin = await AdminUser.exists({
      role: "super_admin",
      status: "active",
    });

    res.json({
      hasSuperAdmin: Boolean(hasSuperAdmin),
      canCreateSuperAdmin: false,
      mode: "local_admin_seed",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/bootstrap-super-admin", async (req, res) => {
  return res.status(403).json({
    message:
      "Public super admin creation is disabled. The first super admin is automatically created by the backend seed. Create additional admins inside the dashboard.",
  });
});

router.post("/admin/login", async (req, res, next) => {
  try {
    const login = normalizeUsername(req.body.login || req.body.username || req.body.email || "");
    const password = req.body.password || "";

    if (!login || !password) {
      return res.status(400).json({ message: "Username or email and password are required" });
    }

    const adminUser = await AdminUser.findOne({
      $or: [{ username: login }, { email: normalizeEmail(login) }],
    }).select("+passwordHash");

    if (!adminUser) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    if (adminUser.status !== "active") {
      return res.status(403).json({ message: "This admin account is disabled" });
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.passwordHash || "");

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    adminUser.lastLoginAt = new Date();
    await adminUser.save();

    const token = signAdminToken(adminUser);

    res.json({
      message: "Admin login successful",
      token,
      admin: cleanAdminUser(adminUser),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/admin/me", requireAdminSession, async (req, res) => {
  res.json({
    accountType: "admin",
    isAdmin: true,
    adminRole: req.adminUser.role,
    moduleAccess: getEffectiveModuleAccess(req.adminUser),
    availableModules: ["dashboard", "registrations", "bookings", "containers", "documents", "reports"],
    adminUser: cleanAdminUser(req.adminUser),
  });
});

router.get("/me", requireUser, async (req, res, next) => {
  try {
    const account = await resolveSignedInAccount(req.clerkUserId);

    res.json({
      clerkUserId: account.clerkUserId,
      email: account.email,
      username: account.username,
      firstName: account.firstName,
      middleName: account.middleName,
      lastName: account.lastName,
      phoneNumber: account.phoneNumber,
      accountType: account.accountType,
      isAdmin: account.isAdmin,
      adminRole: account.adminRole,
      adminUser: account.adminUser,
      isClient: account.isClient,
      registration: account.registration,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
