import jwt from "jsonwebtoken";
import { clerkClient, getAuth } from "@clerk/express";
import AdminUser from "../models/AdminUser.js";
import Registration from "../models/Registration.js";
import { attachRegistrationCompleteness } from "../utils/registrationValidation.js";

export const ADMIN_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "registrations", label: "Company Verification" },
  { key: "bookings", label: "Booking Requests" },
  { key: "containers", label: "Container Setup" },
  { key: "documents", label: "Documents" },
  { key: "reports", label: "Reports" },
];

export const ADMIN_MODULE_KEYS = ADMIN_MODULES.map((item) => item.key);

export const normalizeEmail = (email = "") => email.trim().toLowerCase();

export const normalizeUsername = (username = "") => username.trim().toLowerCase();

export const isSystemSuperAdminRecord = (adminUser) => {
  return Boolean(adminUser?.systemSuperAdmin || adminUser?.bootstrapKey === "primary-super-admin");
};

export const sanitizeModuleAccess = (moduleAccess = []) => {
  if (!Array.isArray(moduleAccess)) return [];
  return [...new Set(moduleAccess.filter((item) => ADMIN_MODULE_KEYS.includes(item)))];
};

export const getEffectiveModuleAccess = (adminUser) => {
  if (!adminUser) return [];

  if (adminUser.role === "super_admin" || isSystemSuperAdminRecord(adminUser)) {
    return [...ADMIN_MODULE_KEYS, "admins"];
  }

  return sanitizeModuleAccess(adminUser.moduleAccess || []);
};

export const adminHasModuleAccess = (adminUser, moduleKey) => {
  if (!moduleKey || moduleKey === "dashboard") return true;
  return getEffectiveModuleAccess(adminUser).includes(moduleKey);
};

export const getAdminJwtSecret = () => {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "change-this-admin-secret";
};

export const signAdminToken = (adminUser) => {
  return jwt.sign(
    {
      adminUserId: String(adminUser._id),
      role: adminUser.role,
      username: adminUser.username,
    },
    getAdminJwtSecret(),
    { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "7d" }
  );
};

export const getPrimaryEmail = (user) => {
  const primaryEmail = user?.emailAddresses?.find(
    (item) => item.id === user.primaryEmailAddressId
  );

  return normalizeEmail(primaryEmail?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "");
};

export const getClerkUserProfile = async (clerkUserId) => {
  if (!clerkUserId) return null;
  return clerkClient.users.getUser(clerkUserId);
};

export const resolveSignedInAccount = async (clerkUserId) => {
  const user = await getClerkUserProfile(clerkUserId);
  const email = getPrimaryEmail(user);
  const username = normalizeUsername(user?.username || "");
  const firstName = user?.firstName || "";
  const lastName = user?.lastName || "";
  const middleName = user?.publicMetadata?.middleName || user?.privateMetadata?.middleName || "";
  const phoneNumber = user?.publicMetadata?.phoneNumber || user?.privateMetadata?.phoneNumber || "";

  const activeAdmin = email
    ? await AdminUser.findOne({ email, status: "active" }).select("email username firstName middleName lastName phoneNumber role status systemSuperAdmin bootstrapKey moduleAccess")
    : null;

  const registration = await Registration.findOne({ clerkUserId });

  let accountType = "unregistered";

  if (activeAdmin) {
    accountType = "admin";
  } else if (registration) {
    accountType = "client";
  }

  return {
    clerkUserId,
    email,
    username,
    firstName,
    middleName,
    lastName,
    phoneNumber,
    accountType,
    isAdmin: Boolean(activeAdmin),
    adminRole: activeAdmin?.role || null,
    adminUser: activeAdmin,
    isClient: Boolean(registration),
    registration: registration ? attachRegistrationCompleteness(registration) : null,
  };
};

export const requireUser = (req, res, next) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  req.clerkUserId = userId;
  return next();
};

const getAdminTokenFromRequest = (req) => {
  const headerToken = req.get("x-admin-token");

  if (headerToken) return headerToken;

  const authHeader = req.get("authorization") || "";

  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
};

export const requireAdminSession = async (req, res, next) => {
  try {
    const token = getAdminTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({ message: "Admin login required" });
    }

    let payload;

    try {
      payload = jwt.verify(token, getAdminJwtSecret());
    } catch {
      return res.status(401).json({ message: "Admin session expired. Please login again." });
    }

    const adminUser = await AdminUser.findById(payload.adminUserId);

    if (!adminUser || adminUser.status !== "active") {
      return res.status(403).json({ message: "Admin account is disabled or no longer exists" });
    }

    req.adminUser = adminUser;
    req.adminRole = adminUser.role;
    req.adminUserId = String(adminUser._id);
    req.adminModuleAccess = getEffectiveModuleAccess(adminUser);
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireSuperAdmin = (req, res, next) => {
  if (req.adminRole !== "super_admin") {
    return res.status(403).json({ message: "Super admin access required" });
  }

  return next();
};

export const requireModuleAccess = (moduleKey) => (req, res, next) => {
  if (req.adminRole === "super_admin") {
    return next();
  }

  if (!adminHasModuleAccess(req.adminUser, moduleKey)) {
    return res.status(403).json({ message: `Access denied. Missing ${moduleKey} module access.` });
  }

  return next();
};
