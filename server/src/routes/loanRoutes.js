import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getLoanConfig,
  applyForLoan,
  getMyLoanApplications,
} from "../controllers/loanController.js";

const router = express.Router();

// Public/authenticated loan configuration
router.get("/config", getLoanConfig);

// All application routes require authentication
router.use(authMiddleware);

router.post("/apply", applyForLoan);
router.get("/my-applications", getMyLoanApplications);

export default router;
