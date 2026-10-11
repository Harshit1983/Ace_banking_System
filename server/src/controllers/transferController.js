
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

const parseAmountToPaise = (amount) => {
  const value = String(amount ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [rupees, fraction = ""] = value.split(".");
  const paise =
    Number(rupees) * 100 +
    Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(paise) || paise <= 0) {
    return null;
  }

  return paise;
};

export const transferMoney = async (req, res) => {
  const { receiverAccountNo, remark = "" } = req.body;
  const amountPaise = parseAmountToPaise(req.body.amount);

  if (!receiverAccountNo || amountPaise === null) {
    return res.status(400).json({
      success: false,
      message: "Recipient account number and a valid positive amount are required",
    });
  }

  if (typeof receiverAccountNo !== "string" &&
      typeof receiverAccountNo !== "number") {
    return res.status(400).json({
      success: false,
      message: "Invalid recipient account number",
    });
  }

  if (typeof remark !== "string" || remark.length > 255) {
    return res.status(400).json({
      success: false,
      message: "Remark must be a string of at most 255 characters",
    });
  }

  const receiverNo = String(receiverAccountNo).trim();

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const sender = await Account.findOne({
        userId: req.user.id,
        status: "ACTIVE",
      }).session(session);

      if (!sender) {
        throw new Error("SENDER_ACCOUNT_NOT_FOUND");
      }

      const receiver = await Account.findOne({
        accountNo: receiverNo,
        status: "ACTIVE",
      }).session(session);

      if (!receiver) {
        throw new Error("RECEIVER_ACCOUNT_NOT_FOUND");
      }

      if (sender._id.equals(receiver._id)) {
        throw new Error("SELF_TRANSFER");
      }

      const debitedSender = await Account.findOneAndUpdate(
        {
          _id: sender._id,
          status: "ACTIVE",
          balancePaise: { $gte: amountPaise },
        },
        {
          $inc: { balancePaise: -amountPaise },
        },
        {
          new: true,
          session,
        }
      );

      if (!debitedSender) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const creditedReceiver = await Account.findOneAndUpdate(
        {
          _id: receiver._id,
          status: "ACTIVE",
        },
        {
          $inc: { balancePaise: amountPaise },
        },
        {
          new: true,
          session,
        }
      );

      if (!creditedReceiver) {
        throw new Error("RECEIVER_ACCOUNT_NOT_FOUND");
      }

      await Transaction.create(
        [
          {
            senderAccount: debitedSender._id,
            receiverAccount: creditedReceiver._id,
            amountPaise,
            txType: "TRANSFER",
            remark: remark.trim(),
          },
        ],
        { session }
      );

      result = {
        amountPaise,
        amountRupees: amountPaise / 100,
        senderBalancePaise: debitedSender.balancePaise,
        senderBalanceRupees: debitedSender.balancePaise / 100,
        receiverAccountNo: creditedReceiver.accountNo,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Transfer successful",
      ...result,
    });
  } catch (error) {
    const errors = {
      SENDER_ACCOUNT_NOT_FOUND: [404, "Your active bank account was not found"],
      RECEIVER_ACCOUNT_NOT_FOUND: [404, "Recipient account was not found or is inactive"],
      SELF_TRANSFER: [400, "You cannot transfer money to your own account"],
      INSUFFICIENT_BALANCE: [400, "Insufficient balance"],
    };

    if (errors[error.message]) {
      const [status, message] = errors[error.message];

      return res.status(status).json({
        success: false,
        message,
      });
    }

    console.error("Transfer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Transfer failed",
    });
  } finally {
    await session.endSession();
  }
};