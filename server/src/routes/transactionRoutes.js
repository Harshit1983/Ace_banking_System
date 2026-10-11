
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  deposit,
  withdraw,
  getTransactionHistory,
} from "../controllers/transactionController.js";

const router = express.Router();

// Every transaction endpoint requires a valid JWT.
router.use(authMiddleware);

router.post("/deposit", deposit);
router.post("/withdraw", withdraw);
router.get("/history", getTransactionHistory);

export default router;