const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const hasValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());

const hasFile = (file) => Boolean(file?.path || file?.filename || file?.originalName);

const hasUploadedFile = (files, fieldName) => Boolean(files?.[fieldName]?.[0]);

const hasOrigin = (origins) => Array.isArray(origins) && origins.length > 0;

export const registrationChecklistDefinitions = [
  { key: "companyName", label: "Company Name" },
  { key: "companyAddress", label: "Company Address" },
  { key: "email", label: "Email" },
  { key: "phoneNumber", label: "Phone Number" },
  { key: "repFirstName", label: "Representative First Name" },
  { key: "repMiddleName", label: "Representative Middle Name" },
  { key: "repLastName", label: "Representative Last Name" },
  { key: "repPosition", label: "Representative Position" },
  { key: "companyType", label: "Type of Company" },
  { key: "otherCompanyType", label: "Other Company Type" },
  { key: "safekeepingOrigins", label: "Container Origin for Safekeeping" },
  { key: "governmentId", label: "Valid Government Issued ID" },
  { key: "dtiOrSec", label: "DTI or SEC Certificate of Registration" },
  { key: "bir2303", label: "BIR 2303" },
  { key: "businessPermit", label: "Business Permit" },
];

export const buildRegistrationCreateChecklist = ({ body = {}, files = {}, safekeepingOrigins = [] }) => {
  const companyType = String(body.companyType || "").trim();

  const checklist = [
    { key: "companyName", label: "Company Name", complete: hasText(body.companyName) },
    { key: "companyAddress", label: "Company Address", complete: hasText(body.companyAddress) },
    { key: "email", label: "Email", complete: hasValidEmail(body.email) },
    { key: "phoneNumber", label: "Phone Number", complete: hasText(body.phoneNumber) },
    { key: "repFirstName", label: "Representative First Name", complete: hasText(body.repFirstName) },
    { key: "repMiddleName", label: "Representative Middle Name", complete: hasText(body.repMiddleName) },
    { key: "repLastName", label: "Representative Last Name", complete: hasText(body.repLastName) },
    { key: "repPosition", label: "Representative Position", complete: hasText(body.repPosition) },
    { key: "companyType", label: "Type of Company", complete: hasText(companyType) },
    {
      key: "otherCompanyType",
      label: "Other Company Type",
      complete: companyType !== "other" || hasText(body.otherCompanyType),
    },
    {
      key: "safekeepingOrigins",
      label: "Container Origin for Safekeeping",
      complete: hasOrigin(safekeepingOrigins),
    },
    {
      key: "governmentId",
      label: "Valid Government Issued ID",
      complete: hasUploadedFile(files, "governmentId"),
    },
    {
      key: "dtiOrSec",
      label: "DTI or SEC Certificate of Registration",
      complete: hasUploadedFile(files, "dtiOrSec"),
    },
    {
      key: "bir2303",
      label: "BIR 2303",
      complete: hasUploadedFile(files, "bir2303"),
    },
    {
      key: "businessPermit",
      label: "Business Permit",
      complete: hasUploadedFile(files, "businessPermit"),
    },
  ];

  const missingFields = checklist.filter((item) => !item.complete).map((item) => item.label);

  return {
    checklist,
    missingFields,
    isComplete: missingFields.length === 0,
  };
};

export const buildRegistrationRecordChecklist = (registration) => {
  const item = registration?.toObject ? registration.toObject() : registration || {};
  const companyType = String(item.companyType || "").trim();

  const checklist = [
    { key: "companyName", label: "Company Name", complete: hasText(item.companyName) },
    { key: "companyAddress", label: "Company Address", complete: hasText(item.companyAddress) },
    { key: "email", label: "Email", complete: hasValidEmail(item.email) },
    { key: "phoneNumber", label: "Phone Number", complete: hasText(item.phoneNumber) },
    { key: "repFirstName", label: "Representative First Name", complete: hasText(item.representative?.firstName) },
    { key: "repMiddleName", label: "Representative Middle Name", complete: hasText(item.representative?.middleName) },
    { key: "repLastName", label: "Representative Last Name", complete: hasText(item.representative?.lastName) },
    { key: "repPosition", label: "Representative Position", complete: hasText(item.representative?.position) },
    { key: "companyType", label: "Type of Company", complete: hasText(companyType) },
    {
      key: "otherCompanyType",
      label: "Other Company Type",
      complete: companyType !== "other" || hasText(item.otherCompanyType),
    },
    {
      key: "safekeepingOrigins",
      label: "Container Origin for Safekeeping",
      complete: hasOrigin(item.safekeepingOrigins),
    },
    {
      key: "governmentId",
      label: "Valid Government Issued ID",
      complete: hasFile(item.documents?.governmentId),
    },
    {
      key: "dtiOrSec",
      label: "DTI or SEC Certificate of Registration",
      complete: hasFile(item.documents?.dtiOrSec),
    },
    {
      key: "bir2303",
      label: "BIR 2303",
      complete: hasFile(item.documents?.bir2303),
    },
    {
      key: "businessPermit",
      label: "Business Permit",
      complete: hasFile(item.documents?.businessPermit),
    },
  ];

  const missingFields = checklist.filter((entry) => !entry.complete).map((entry) => entry.label);

  return {
    checklist,
    missingFields,
    isComplete: missingFields.length === 0,
  };
};

export const attachRegistrationCompleteness = (registration) => {
  const item = registration?.toObject ? registration.toObject() : registration;
  const completeness = buildRegistrationRecordChecklist(item);

  return {
    ...item,
    verificationChecklist: completeness.checklist,
    missingFields: completeness.missingFields,
    isCompleteForVerification: completeness.isComplete,
  };
};
