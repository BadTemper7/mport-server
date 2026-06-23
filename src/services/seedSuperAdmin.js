import bcrypt from "bcryptjs";
import AdminUser from "../models/AdminUser.js";
import { ADMIN_MODULE_KEYS } from "../middleware/auth.js";

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();

const getSeedSuperAdminConfig = () => ({
  enabled: (process.env.SEED_SUPER_ADMIN_ENABLED || "true") === "true",
  username: normalizeUsername(process.env.SEED_SUPER_ADMIN_USERNAME || "mport-admin"),
  email: normalizeEmail(process.env.SEED_SUPER_ADMIN_EMAIL || "mport-admin@mport.local"),
  password: process.env.SEED_SUPER_ADMIN_PASSWORD || "Mport_2026",
  firstName: (process.env.SEED_SUPER_ADMIN_FIRST_NAME || "Mega Port").trim(),
  middleName: (process.env.SEED_SUPER_ADMIN_MIDDLE_NAME || "").trim(),
  lastName: (process.env.SEED_SUPER_ADMIN_LAST_NAME || "Super Admin").trim(),
  phoneNumber: (process.env.SEED_SUPER_ADMIN_PHONE_NUMBER || "").trim(),
});

export const ensureSeedSuperAdmin = async () => {
  const config = getSeedSuperAdminConfig();

  if (!config.enabled) {
    console.warn("Seed super admin skipped because it is disabled in env.");
    return null;
  }

  if (!config.username || !config.email || !config.password) {
    console.warn("Seed super admin skipped because username, email, or password is missing.");
    return null;
  }

  try {
    let adminUser = await AdminUser.findOne({
      $or: [
        { bootstrapKey: "primary-super-admin" },
        { username: config.username },
        { email: config.email },
      ],
    }).select("+passwordHash");

    if (!adminUser) {
      const passwordHash = await bcrypt.hash(config.password, 12);

      adminUser = await AdminUser.create({
        email: config.email,
        username: config.username,
        passwordHash,
        firstName: config.firstName,
        middleName: config.middleName,
        lastName: config.lastName,
        phoneNumber: config.phoneNumber,
        role: "super_admin",
        status: "active",
        systemSuperAdmin: true,
        bootstrapKey: "primary-super-admin",
        moduleAccess: ADMIN_MODULE_KEYS,
      });

      console.log(`Created local seed super admin: ${config.username}`);
      return adminUser;
    }

    adminUser.email = adminUser.email || config.email;
    adminUser.username = adminUser.username || config.username;
    adminUser.firstName = adminUser.firstName || config.firstName;
    adminUser.middleName = adminUser.middleName || config.middleName;
    adminUser.lastName = adminUser.lastName || config.lastName;
    adminUser.phoneNumber = adminUser.phoneNumber || config.phoneNumber;
    adminUser.role = "super_admin";
    adminUser.status = "active";
    adminUser.systemSuperAdmin = true;
    adminUser.bootstrapKey = "primary-super-admin";
    adminUser.moduleAccess = ADMIN_MODULE_KEYS;

    if (!adminUser.passwordHash) {
      adminUser.passwordHash = await bcrypt.hash(config.password, 12);
    }

    await adminUser.save();
    console.log(`Local seed super admin is ready: ${adminUser.username}`);
    return adminUser;
  } catch (error) {
    console.error("Seed super admin failed:", error?.message || error);
    return null;
  }
};
