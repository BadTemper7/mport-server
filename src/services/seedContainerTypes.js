import ContainerType from "../models/ContainerType.js";

const DEFAULT_CONTAINER_TYPES = [
  { label: '20" Dry', value: "20 Dry", description: "Standard 20-foot dry container", displayOrder: 10 },
  { label: '20" Reefer', value: "20 Reefer", description: "20-foot refrigerated container", displayOrder: 20 },
  { label: '40" Dry', value: "40 Dry", description: "Standard 40-foot dry container", displayOrder: 30 },
  { label: '40" Reefer', value: "40 Reefer", description: "40-foot refrigerated container", displayOrder: 40 },
  { label: "Other Specify", value: "Other", description: "Client must specify the exact container type", displayOrder: 50 },
];

export const ensureDefaultContainerTypes = async () => {
  const count = await ContainerType.countDocuments();

  if (count > 0) {
    return;
  }

  await ContainerType.insertMany(DEFAULT_CONTAINER_TYPES);
  console.log("Default container types seeded");
};
