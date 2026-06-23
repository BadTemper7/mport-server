import express from "express";
import Booking from "../models/Booking.js";
import Registration from "../models/Registration.js";
import ContainerType from "../models/ContainerType.js";
import { requireUser } from "../middleware/auth.js";
import { fileToObject, uploadBookingFiles } from "../middleware/upload.js";
import { buildRegistrationRecordChecklist } from "../utils/registrationValidation.js";
import { emitRealtimeUpdate } from "../utils/realtime.js";

const router = express.Router();

const requireVerifiedRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findOne({ clerkUserId: req.clerkUserId });

    if (!registration) {
      return res.status(403).json({ message: "Please submit your company registration first" });
    }

    if (registration.status !== "verified") {
      return res.status(403).json({ message: "Account must be verified before booking" });
    }

    const completeness = buildRegistrationRecordChecklist(registration);
    if (!completeness.isComplete) {
      return res.status(403).json({
        message: `Account record is incomplete. Missing: ${completeness.missingFields.join(", ")}`,
        missingFields: completeness.missingFields,
      });
    }

    req.registration = registration;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get("/me", requireUser, async (req, res, next) => {
  try {
    const bookings = await Booking.find({ clerkUserId: req.clerkUserId }).sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requireUser,
  requireVerifiedRegistration,
  uploadBookingFiles,
  async (req, res, next) => {
    try {
      const files = req.files || {};
      const isEmpty = req.body.loadStatus === "Empty";
      const containerSizeType = (req.body.containerSizeType || "").trim();
      const otherContainerSizeType = (req.body.otherContainerSizeType || "").trim();
      const safekeepingOrigin = (req.body.safekeepingOrigin || "").trim();
      const allowedOrigins = req.registration.safekeepingOrigins || [];

      if (!allowedOrigins.includes(safekeepingOrigin)) {
        return res.status(400).json({ message: "Please select one of your verified container origins for safekeeping" });
      }

      const activeContainerType = await ContainerType.findOne({
        value: containerSizeType,
        isActive: true,
      });

      if (!activeContainerType) {
        return res.status(400).json({ message: "Please select a valid active container size/type" });
      }

      if (containerSizeType === "Other" && !otherContainerSizeType) {
        return res.status(400).json({ message: "Please specify the container size/type" });
      }

      const booking = await Booking.create({
        clerkUserId: req.clerkUserId,
        registrationId: req.registration._id,
        companyName: req.registration.companyName,
        name: {
          firstName: req.registration.representative?.firstName || "",
          middleName: req.registration.representative?.middleName || "",
          lastName: req.registration.representative?.lastName || "",
        },
        address: req.registration.companyAddress,
        emailAddress: req.registration.email,
        contactNumber: req.registration.phoneNumber,
        transactionType: req.body.transactionType,
        truckerName: req.body.truckerName,
        truckPlateNo: req.body.truckPlateNo,
        driver: {
          firstName: req.body.driverFirstName,
          middleName: req.body.driverMiddleName,
          lastName: req.body.driverLastName,
          licenseNo: req.body.driverLicenseNo,
          licensePicture: fileToObject(files.driverLicensePicture?.[0]),
        },
        containerNo: req.body.containerNo,
        containerSizeType,
        otherContainerSizeType,
        loadStatus: req.body.loadStatus,
        loadedDescription: isEmpty ? "N/A" : req.body.loadedDescription,
        declaredGrossWeight: isEmpty ? "N/A" : req.body.declaredGrossWeight,
        shippingLines: req.body.shippingLines,
        safekeepingOrigin,
        bookingDate: req.body.bookingDate,
        bookingTimeRequest: req.body.bookingTimeRequest,
        estimatedSafekeepingDays: req.body.estimatedSafekeepingDays,
        acceptedTerms: req.body.acceptedTerms === "true" || req.body.acceptedTerms === true,
      });

      emitRealtimeUpdate(req, "bookings:changed", { action: "created", bookingId: String(booking._id) });

      res.status(201).json({ booking });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
