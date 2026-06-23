import express from "express";
import Registration from "../models/Registration.js";
import AdminUser from "../models/AdminUser.js";
import { requireUser } from "../middleware/auth.js";
import { fileToObject, uploadRegistrationFiles } from "../middleware/upload.js";
import { attachRegistrationCompleteness, buildRegistrationCreateChecklist } from "../utils/registrationValidation.js";
import { emitRealtimeUpdate } from "../utils/realtime.js";

const router = express.Router();

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [value];
  }
};

router.get("/me", requireUser, async (req, res, next) => {
  try {
    const registration = await Registration.findOne({ clerkUserId: req.clerkUserId });
    res.json({ registration: registration ? attachRegistrationCompleteness(registration) : null });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireUser, uploadRegistrationFiles, async (req, res, next) => {
  try {
    const existing = await Registration.findOne({ clerkUserId: req.clerkUserId });

    if (existing) {
      const message = existing.status === "verified"
        ? "Your company account is already verified. You cannot register again with this account."
        : "Registration already submitted. Please wait for admin verification or review the current status.";

      return res.status(409).json({ message });
    }

    const submittedEmail = (req.body.email || "").trim().toLowerCase();
    const adminEmailExists = await AdminUser.exists({
      email: submittedEmail,
      status: "active",
    });

    if (adminEmailExists) {
      return res.status(409).json({
        message: "This email is already registered as an admin account. Use a different client email.",
      });
    }

    const files = req.files || {};
    const safekeepingOrigins = parseJsonArray(req.body.safekeepingOrigins);
    const completeness = buildRegistrationCreateChecklist({
      body: req.body,
      files,
      safekeepingOrigins,
    });

    if (!completeness.isComplete) {
      return res.status(400).json({
        message: `Please complete all required registration fields before submitting. Missing: ${completeness.missingFields.join(", ")}`,
        missingFields: completeness.missingFields,
        verificationChecklist: completeness.checklist,
      });
    }

    const registration = await Registration.create({
      clerkUserId: req.clerkUserId,
      companyName: req.body.companyName,
      companyAddress: req.body.companyAddress,
      email: submittedEmail,
      phoneNumber: req.body.phoneNumber,
      representative: {
        firstName: req.body.repFirstName,
        middleName: req.body.repMiddleName,
        lastName: req.body.repLastName,
        position: req.body.repPosition,
      },
      companyType: req.body.companyType,
      otherCompanyType: req.body.otherCompanyType || "",
      safekeepingOrigins,
      documents: {
        governmentId: fileToObject(files.governmentId?.[0]),
        dtiOrSec: fileToObject(files.dtiOrSec?.[0]),
        bir2303: fileToObject(files.bir2303?.[0]),
        businessPermit: fileToObject(files.businessPermit?.[0]),
      },
      status: "pending",
    });

    emitRealtimeUpdate(req, "registrations:changed", { action: "created", registrationId: String(registration._id) });

    res.status(201).json({ registration: attachRegistrationCompleteness(registration) });
  } catch (error) {
    next(error);
  }
});

export default router;
