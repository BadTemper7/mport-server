import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    originalName: String,
    filename: String,
    mimetype: String,
    size: Number,
    path: String,
  },
  { _id: false }
);

const registrationSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    companyAddress: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    representative: {
      firstName: { type: String, required: true, trim: true },
      middleName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      position: { type: String, required: true, trim: true },
    },
    companyType: {
      type: String,
      enum: ["trucking", "customs brokerage", "consignee/importer", "other"],
      required: true,
    },
    otherCompanyType: {
      type: String,
      trim: true,
      default: "",
    },
    safekeepingOrigins: [
      {
        type: String,
        enum: ["Local Shipping Lines", "International Shipping Lines"],
      },
    ],
    documents: {
      governmentId: fileSchema,
      dtiOrSec: fileSchema,
      bir2303: fileSchema,
      businessPermit: fileSchema,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    adminRemarks: {
      type: String,
      default: "",
    },
    verifiedAt: Date,
    reviewedAt: Date,
    reviewedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Registration", registrationSchema);
