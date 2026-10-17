import crypto from "crypto";
import LoanApplication from "../models/LoanApplication.js";
import User from "../models/User.js";
import { sendLoanConfirmationEmail } from "../services/emailService.js";

// Configurable Loan Products Rules
export const LOAN_CONFIG = {
  PERSONAL_LOAN: {
    name: "Personal Loan",
    minAmountRupees: 10000,
    maxAmountRupees: 2500000,
    minTenureMonths: 6,
    maxTenureMonths: 60,
    minMonthlyIncomeRupees: 15000,
  },
  HOME_LOAN: {
    name: "Home Loan",
    minAmountRupees: 100000,
    maxAmountRupees: 100000000,
    minTenureMonths: 12,
    maxTenureMonths: 360,
    minMonthlyIncomeRupees: 25000,
  },
  EMPLOYMENT_TYPES: ["SALARIED", "SELF_EMPLOYED", "BUSINESS", "OTHER"],
};

// Helper: parse rupee string or number to integer paise
const parseAmountToPaise = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const str = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return null;
  }

  const num = Number(str);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }

  const paise = Math.round(num * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    return null;
  }

  return paise;
};

// Generates a unique, professional application reference ID
const generateApplicationRef = (loanType) => {
  const prefix = loanType === "HOME_LOAN" ? "HL" : "PL";
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ACE-${prefix}-${timestamp}-${randomSuffix}`;
};

/**
 * Return loan configuration to frontend
 */
export const getLoanConfig = (req, res) => {
  return res.status(200).json({
    success: true,
    config: LOAN_CONFIG,
  });
};

/**
 * Submit a new loan application
 */
export const applyForLoan = async (req, res) => {
  try {
    const {
      loanType,
      amount,
      monthlyIncome,
      employmentType,
      employmentDurationMonths,
      tenureMonths,
      purpose = "",
    } = req.body;

    // 1. Validate loan type
    if (!loanType || !["HOME_LOAN", "PERSONAL_LOAN"].includes(loanType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid loan type. Choose either HOME_LOAN or PERSONAL_LOAN.",
      });
    }

    const rules = LOAN_CONFIG[loanType];

    // 2. Validate amount
    const amountPaise = parseAmountToPaise(amount);
    if (amountPaise === null) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid positive loan amount with at most two decimal places.",
      });
    }

    const amountRupees = amountPaise / 100;
    if (
      amountRupees < rules.minAmountRupees ||
      amountRupees > rules.maxAmountRupees
    ) {
      return res.status(400).json({
        success: false,
        message: `${rules.name} amount must be between ₹${rules.minAmountRupees.toLocaleString("en-IN")} and ₹${rules.maxAmountRupees.toLocaleString("en-IN")}.`,
      });
    }

    // 3. Validate monthly income
    const monthlyIncomePaise = parseAmountToPaise(monthlyIncome);
    if (monthlyIncomePaise === null) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid positive monthly income.",
      });
    }

    const monthlyIncomeRupees = monthlyIncomePaise / 100;
    if (monthlyIncomeRupees < rules.minMonthlyIncomeRupees) {
      return res.status(400).json({
        success: false,
        message: `Minimum monthly income required for ${rules.name} is ₹${rules.minMonthlyIncomeRupees.toLocaleString("en-IN")}.`,
      });
    }

    // 4. Validate employment type
    if (!employmentType || !LOAN_CONFIG.EMPLOYMENT_TYPES.includes(employmentType)) {
      return res.status(400).json({
        success: false,
        message: `Employment type must be one of: ${LOAN_CONFIG.EMPLOYMENT_TYPES.join(", ")}.`,
      });
    }

    // 5. Validate employment duration
    const parsedDuration = parseInt(employmentDurationMonths, 10);
    if (isNaN(parsedDuration) || parsedDuration < 0 || parsedDuration > 600) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid employment duration in months (0–600).",
      });
    }

    // 6. Validate tenure
    const parsedTenure = parseInt(tenureMonths, 10);
    if (
      isNaN(parsedTenure) ||
      parsedTenure < rules.minTenureMonths ||
      parsedTenure > rules.maxTenureMonths
    ) {
      return res.status(400).json({
        success: false,
        message: `${rules.name} tenure must be between ${rules.minTenureMonths} and ${rules.maxTenureMonths} months.`,
      });
    }

    // 7. Validate purpose (optional)
    if (typeof purpose !== "string" || purpose.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Loan purpose must not exceed 500 characters.",
      });
    }

    // 8. Fetch authenticated user contact details
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User record not found.",
      });
    }

    // 9. Generate reference ID and save application
    const applicationRef = generateApplicationRef(loanType);

    const application = await LoanApplication.create({
      applicant: user._id,
      applicationRef,
      loanType,
      amountPaise,
      monthlyIncomePaise,
      employmentType,
      employmentDurationMonths: parsedDuration,
      tenureMonths: parsedTenure,
      purpose: purpose.trim(),
      applicantContact: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      status: "PENDING",
    });

    // 10. Send confirmation email (failure must not fail or duplicate the saved application)
    try {
      await sendLoanConfirmationEmail({
        to: user.email,
        firstName: user.firstName,
        applicationRef,
        loanType,
        amountRupees,
        tenureMonths: parsedTenure,
      });
    } catch (emailError) {
      console.error(
        "Loan confirmation email delivery failed for application:",
        applicationRef
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Loan application submitted successfully. Application is pending underwriting review.",
      application: {
        id: application._id,
        applicationRef: application.applicationRef,
        loanType: application.loanType,
        amountRupees,
        amountPaise,
        monthlyIncomeRupees,
        tenureMonths: application.tenureMonths,
        employmentType: application.employmentType,
        employmentDurationMonths: application.employmentDurationMonths,
        purpose: application.purpose,
        status: application.status,
        createdAt: application.createdAt,
      },
    });
  } catch (error) {
    console.error("Apply for loan error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process your loan application. Please try again.",
    });
  }
};

/**
 * Retrieve all loan applications belonging to the authenticated user
 */
export const getMyLoanApplications = async (req, res) => {
  try {
    const applications = await LoanApplication.find({
      applicant: req.user.id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = applications.map((app) => ({
      id: app._id,
      applicationRef: app.applicationRef,
      loanType: app.loanType,
      amountRupees: app.amountPaise / 100,
      amountPaise: app.amountPaise,
      monthlyIncomeRupees: app.monthlyIncomePaise / 100,
      employmentType: app.employmentType,
      employmentDurationMonths: app.employmentDurationMonths,
      tenureMonths: app.tenureMonths,
      purpose: app.purpose,
      status: app.status,
      createdAt: app.createdAt,
    }));

    return res.status(200).json({
      success: true,
      applications: formatted,
    });
  } catch (error) {
    console.error("Get loan applications error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve loan applications.",
    });
  }
};
