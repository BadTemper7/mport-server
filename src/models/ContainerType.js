import mongoose from "mongoose";

const containerTypeSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
    updatedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
  },
  { timestamps: true }
);

export default mongoose.model("ContainerType", containerTypeSchema);
