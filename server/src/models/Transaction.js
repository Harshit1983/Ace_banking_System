
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    senderAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    receiverAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Transaction amount must be a whole number of paise",
      },
    },

    txType: {
      type: String,
      enum: ["TRANSFER", "DEPOSIT", "WITHDRAWAL"],
      required: true,
    },

    remark: {
      type: String,
      trim: true,
      maxlength: 255,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

transactionSchema.index({ senderAccount: 1, createdAt: -1 });
transactionSchema.index({ receiverAccount: 1, createdAt: -1 });

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);

export default Transaction;