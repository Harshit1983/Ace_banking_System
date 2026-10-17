import mongoose from "mongoose";

const loanApplicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    applicationRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    loanType: {
      type: String,
      enum: ["HOME_LOAN", "PERSONAL_LOAN"],
      required: true,
    },

    // Amount stored in paise internally
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Loan amount must be a whole number of paise",
      },
    },

    // Monthly income stored in paise internally
    monthlyIncomePaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Monthly income must be a whole number of paise",
      },
    },

    employmentType: {
      type: String,
      enum: ["SALARIED", "SELF_EMPLOYED", "BUSINESS", "OTHER"],
      required: true,
    },

    employmentDurationMonths: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Employment duration must be an integer",
      },
    },

    tenureMonths: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Tenure must be an integer number of months",
      },
    },

    purpose: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    applicantContact: {
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },

    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"],
      default: "PENDING",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

loanApplicationSchema.index({ applicant: 1, createdAt: -1 });

const LoanApplication = mongoose.model("LoanApplication", loanApplicationSchema);

export default LoanApplication;
