import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  deposit,
  withdraw,
  getTransactionHistory,
  downloadStatement,
} from "../controllers/transactionController.js";

const router = express.Router();

// Every transaction endpoint requires a valid JWT.
router.use(authMiddleware);

router.post("/deposit", deposit);
router.post("/withdraw", withdraw);
router.get("/history", getTransactionHistory);
router.get("/statement", downloadStatement);

export default router;