
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import { runTransaction } from "../utils/transactionRunner.js";

// Daily withdrawal limit is ₹500 (50,000 paise).
const DAILY_WITHDRAWAL_LIMIT_PAISE = 50000;

// Accept rupee amounts with at most two decimal places.
const parseAmountToPaise = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const amountString = String(value).trim();

  // Accept only positive amounts with at most two decimal places.
  if (!/^\d+(\.\d{1,2})?$/.test(amountString)) {
    return null;
  }

  const amount = Number(amountString);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const amountPaise = Math.round(amount * 100);

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return null;
  }

  return amountPaise;
};

const getTodayStart = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

export const deposit = async (req, res) => {
  const amountPaise = parseAmountToPaise(req.body.amount);

  if (amountPaise === null) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid positive amount with at most two decimal places",
    });
  }

  try {
    let result;

    await runTransaction(async (session) => {
      const sessionOption = session ? { session } : undefined;

      const accountQuery = Account.findOne({
        userId: req.user.id,
        status: "ACTIVE",
      });
      if (session) accountQuery.session(session);
      const account = await accountQuery;

      if (!account) {
        const error = new Error("ACTIVE_ACCOUNT_NOT_FOUND");
        throw error;
      }

      const updatedAccount = await Account.findOneAndUpdate(
        {
          _id: account._id,
          status: "ACTIVE",
        },
        {
          $inc: { balancePaise: amountPaise },
        },
        {
          returnDocument: "after",
          runValidators: true,
          ...(session ? { session } : {}),
        }
      );

      if (!updatedAccount) {
        throw new Error("ACCOUNT_UPDATE_FAILED");
      }

      await Transaction.create(
        [
          {
            senderAccount: null,
            receiverAccount: updatedAccount._id,
            amountPaise,
            txType: "DEPOSIT",
            remark: "Simulated deposit",
          },
        ],
        sessionOption
      );

      result = {
        accountNo: updatedAccount.accountNo,
        balancePaise: updatedAccount.balancePaise,
        balanceRupees: updatedAccount.balancePaise / 100,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Deposit successful (simulated)",
      ...result,
    });
  } catch (error) {
    if (error.message === "ACTIVE_ACCOUNT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Active bank account not found",
      });
    }

    console.error("Deposit error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Deposit failed",
    });
  }
};

export const withdraw = async (req, res) => {
  const amountPaise = parseAmountToPaise(req.body.amount);

  if (amountPaise === null) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid positive amount with at most two decimal places",
    });
  }

  try {
    let result;

    await runTransaction(async (session) => {
      const sessionOption = session ? { session } : undefined;

      const accountQuery = Account.findOne({
        userId: req.user.id,
        status: "ACTIVE",
      });
      if (session) accountQuery.session(session);
      const account = await accountQuery;

      if (!account) {
        throw new Error("ACTIVE_ACCOUNT_NOT_FOUND");
      }

      // Calculate today's completed withdrawals.
      const aggPipeline = [
        {
          $match: {
            senderAccount: account._id,
            txType: "WITHDRAWAL",
            createdAt: { $gte: getTodayStart() },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amountPaise" },
          },
        },
      ];
      const aggQuery = Transaction.aggregate(aggPipeline);
      if (session) aggQuery.session(session);
      const dailyTotal = await aggQuery;

      const withdrawnToday = dailyTotal[0]?.total ?? 0;

      if (
        withdrawnToday + amountPaise >
        DAILY_WITHDRAWAL_LIMIT_PAISE
      ) {
        throw new Error("DAILY_LIMIT_EXCEEDED");
      }

      // Atomic update: withdraw only if sufficient funds remain.
      const updatedAccount = await Account.findOneAndUpdate(
        {
          _id: account._id,
          balancePaise: { $gte: amountPaise },
          status: "ACTIVE",
        },
        {
          $inc: { balancePaise: -amountPaise },
        },
        {
          returnDocument: "after",
          ...(session ? { session } : {}),
        }
      );

      if (!updatedAccount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await Transaction.create(
        [
          {
            senderAccount: updatedAccount._id,
            receiverAccount: null,
            amountPaise,
            txType: "WITHDRAWAL",
            remark: "Simulated withdrawal",
          },
        ],
        sessionOption
      );

      result = {
        accountNo: updatedAccount.accountNo,
        balancePaise: updatedAccount.balancePaise,
        balanceRupees: updatedAccount.balancePaise / 100,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal successful (simulated)",
      ...result,
    });
  } catch (error) {
    if (error.message === "ACTIVE_ACCOUNT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Active bank account not found",
      });
    }

    if (error.message === "DAILY_LIMIT_EXCEEDED") {
      return res.status(400).json({
        success: false,
        message: "Daily withdrawal limit of ₹500 exceeded",
      });
    }

    if (error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    console.error("Withdrawal error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Withdrawal failed",
    });
  }
};
export const getTransactionHistory = async (req, res) => {
  try {
    // 1. Parse and validate pagination parameters
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100; // Cap page size for safety

    // 2. Validate transaction type filter
    const type = req.query.type ? String(req.query.type).trim().toUpperCase() : null;
    const allowedTypes = ["DEPOSIT", "WITHDRAWAL", "TRANSFER"];

    if (type && type !== "ALL" && !allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type filter. Allowed: ALL, DEPOSIT, WITHDRAWAL, TRANSFER",
      });
    }

    // 3. Find the logged-in user's bank account
    const account = await Account.findOne({
      userId: req.user.id,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Bank account not found",
      });
    }

    // 4. Build query filters
    const filter = {
      $or: [
        { senderAccount: account._id },
        { receiverAccount: account._id },
      ],
    };

    if (type && type !== "ALL") {
      filter.txType = type;
    }

    // Date range filter
    const { startDate, endDate } = req.query;

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate format",
          });
        }
        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate format",
          });
        }
        // If date-only string provided (e.g. YYYY-MM-DD), expand to end of day
        if (typeof endDate === "string" && !endDate.includes("T")) {
          end.setHours(23, 59, 59, 999);
        }
        filter.createdAt.$lte = end;
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte > filter.createdAt.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "startDate cannot be after endDate",
        });
      }
    }

    // 5. Query total count and paginated transactions
    const totalRecords = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderAccount", "accountNo")
      .populate("receiverAccount", "accountNo")
      .lean();

    // 6. Format transaction output
    const formattedTransactions = transactions.map((transaction) => {
      const isIncoming =
        transaction.receiverAccount?._id?.toString() ===
        account._id.toString();

      let direction;

      if (transaction.txType === "DEPOSIT") {
        direction = "CREDIT";
      } else if (transaction.txType === "WITHDRAWAL") {
        direction = "DEBIT";
      } else {
        direction = isIncoming ? "CREDIT" : "DEBIT";
      }

      return {
        _id: transaction._id,
        txType: transaction.txType,
        amountPaise: transaction.amountPaise,
        amountRupees: transaction.amountPaise / 100,
        remark: transaction.remark,
        createdAt: transaction.createdAt,
        direction,
        senderAccount: transaction.senderAccount,
        receiverAccount: transaction.receiverAccount,
      };
    });

    return res.status(200).json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get transaction history error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch transaction history",
    });
  }
};