import fs from "fs";
import path from "path";
import multer from "multer";

const uploadRoot = path.join(process.cwd(), "uploads");

const ensureDirectory = (folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(uploadRoot, file.fieldname);
    ensureDirectory(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${Date.now()}-${safeOriginalName}`);
  },
});

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const fileFilter = (req, file, cb) => {
  if (!allowedTypes.includes(file.mimetype)) {
    cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed"));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const uploadRegistrationFiles = upload.fields([
  { name: "governmentId", maxCount: 1 },
  { name: "dtiOrSec", maxCount: 1 },
  { name: "bir2303", maxCount: 1 },
  { name: "businessPermit", maxCount: 1 },
]);

export const uploadBookingFiles = upload.fields([
  { name: "driverLicensePicture", maxCount: 1 },
]);

export const fileToObject = (file) => {
  if (!file) return null;

  return {
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    path: `/uploads/${file.fieldname}/${file.filename}`,
  };
};
