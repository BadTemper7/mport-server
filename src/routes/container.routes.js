import express from "express";
import ContainerType from "../models/ContainerType.js";

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const containerTypes = await ContainerType.find({ isActive: true }).sort({ displayOrder: 1, label: 1 });
    res.json({ containerTypes });
  } catch (error) {
    next(error);
  }
});

export default router;
