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

const bookingSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: true,
      index: true,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    companyName: { type: String, required: true, trim: true },
    name: {
      firstName: { type: String, required: true, trim: true },
      middleName: { type: String, trim: true },
      lastName: { type: String, required: true, trim: true },
    },
    address: { type: String, required: true, trim: true },
    emailAddress: { type: String, required: true, trim: true, lowercase: true },
    contactNumber: { type: String, required: true, trim: true },
    transactionType: {
      type: String,
      enum: ["Drop Off", "Pick up / Withdraw"],
      required: true,
    },
    truckerName: { type: String, required: true, trim: true },
    truckPlateNo: { type: String, required: true, trim: true },
    driver: {
      firstName: { type: String, required: true, trim: true },
      middleName: { type: String, trim: true },
      lastName: { type: String, required: true, trim: true },
      licenseNo: { type: String, required: true, trim: true },
      licensePicture: fileSchema,
    },
    containerNo: { type: String, required: true, trim: true },
    containerSizeType: {
      type: String,
      required: true,
      trim: true,
    },
    otherContainerSizeType: { type: String, default: "", trim: true },
    loadStatus: {
      type: String,
      enum: ["Empty", "Loaded"],
      required: true,
    },
    loadedDescription: { type: String, default: "N/A", trim: true },
    declaredGrossWeight: { type: String, default: "N/A", trim: true },
    shippingLines: { type: String, required: true, trim: true },
    safekeepingOrigin: {
      type: String,
      enum: ["Local Shipping Lines", "International Shipping Lines"],
      required: true,
    },
    bookingDate: { type: String, required: true },
    bookingTimeRequest: { type: String, required: true },
    estimatedSafekeepingDays: {
      type: String,
      enum: ["1", "2", "3", "4", "5", "6-10", "11-15", "16-30", "more than 31"],
      required: true,
    },
    acceptedTerms: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["submitted", "approved", "rejected", "no show"],
      default: "submitted",
      index: true,
    },
    adminRemarks: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
