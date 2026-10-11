
import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getMyAccount,
  getMyBalance,
} from "../controllers/accountController.js";

const router = express.Router();

// All routes in this file require authentication.
router.use(authMiddleware);

router.get("/me", getMyAccount);
router.get("/balance", getMyBalance);

export default router;