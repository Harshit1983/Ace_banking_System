
import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    accountNo: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    accountType: {
      type: String,
      enum: ["SAVINGS", "CHECKING", "LOAN"],
      default: "SAVINGS",
      required: true,
    },

    // Store money in paise to avoid floating-point errors.
    // Example: ₹100.50 is stored as 10050.
    balancePaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Balance must be a whole number of paise",
      },
    },

    status: {
      type: String,
      enum: ["ACTIVE", "BLOCKED", "CLOSED"],
      default: "ACTIVE",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Account = mongoose.model("Account", accountSchema);

export default Account;