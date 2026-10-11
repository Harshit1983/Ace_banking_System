
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

// The original Java project has a daily withdrawal limit of ₹500.
const DAILY_WITHDRAWAL_LIMIT_PAISE = 50000;

// Accept rupee amounts with at most two decimal places.
const parseAmountToPaise = (amount) => {
  const value = String(amount ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [rupees, fraction = ""] = value.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(paise) || paise <= 0) {
    return null;
  }

  return paise;
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

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const account = await Account.findOne({
        userId: req.user.id,
        status: "ACTIVE",
      }).session(session);

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
          new: true,
          session,
          runValidators: true,
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
        { session }
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
  } finally {
    await session.endSession();
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

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const account = await Account.findOne({
        userId: req.user.id,
        status: "ACTIVE",
      }).session(session);

      if (!account) {
        throw new Error("ACTIVE_ACCOUNT_NOT_FOUND");
      }

      // Calculate today's completed withdrawals.
      const dailyTotal = await Transaction.aggregate([
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
      ]).session(session);

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
          status: "ACTIVE",
          balancePaise: { $gte: amountPaise },
        },
        {
          $inc: { balancePaise: -amountPaise },
        },
        {
          new: true,
          session,
          runValidators: true,
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
        { session }
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
  } finally {
    await session.endSession();
  }
};

export const getTransactionHistory = async (req, res) => {
  try {
    const account = await Account.findOne({
      userId: req.user.id,
    }).select("_id accountNo");

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Bank account not found",
      });
    }

    const transactions = await Transaction.find({
      $or: [
        { senderAccount: account._id },
        { receiverAccount: account._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      accountNo: account.accountNo,
      count: transactions.length,
      transactions: transactions.map((transaction) => ({
        id: transaction._id,
        type: transaction.txType,
        amountPaise: transaction.amountPaise,
        amountRupees: transaction.amountPaise / 100,
        remark: transaction.remark,
        createdAt: transaction.createdAt,
        direction:
          transaction.txType === "DEPOSIT"
            ? "CREDIT"
            : transaction.txType === "WITHDRAWAL"
              ? "DEBIT"
              : transaction.receiverAccount?.toString() ===
                  account._id.toString()
                ? "CREDIT"
                : "DEBIT",
      })),
    });
  } catch (error) {
    console.error("Transaction history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve transaction history",
    });
  }
};