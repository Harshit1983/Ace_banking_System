import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { transferMoney } from "../controllers/transferController.js";

const router = express.Router();

router.post("/", authMiddleware, transferMoney);

export default router;