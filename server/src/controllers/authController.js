import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Account from "../models/Account.js";
import { runTransaction, supportsTransactions } from "../utils/transactionRunner.js";
import {
  sendEmail,
  sendWelcomeEmail,
  sendAccountRecoveryEmail,
  sendPasswordResetEmail,
} from "../services/emailService.js";

// Generates a cryptographically secure 10-digit customer-facing account number.
const generateAccountNumber = () => {
  return String(crypto.randomInt(1000000000, 10000000000));
};

// Generates the JWT token.
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

// ================= REGISTER =================
export const register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      aadhaarNo,
      email,
      password,
    } = req.body;

    // 1. Validate required fields.
    if (
      typeof firstName !== "string" ||
      !firstName.trim() ||
      typeof lastName !== "string" ||
      !lastName.trim() ||
      typeof aadhaarNo !== "string" ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // 2. Validate Aadhaar format.
    if (!/^\d{12}$/.test(aadhaarNo)) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar number must contain exactly 12 digits",
      });
    }

    // 3. Validate email format.
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

    // 4. Validate password length.
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8 to 72 characters",
      });
    }

    // 5. Check for existing users.
    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { aadhaarNo },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email or Aadhaar number is already registered",
      });
    }

    // 6. Hash the password before saving it.
    const passwordHash = await bcrypt.hash(password, 12);

    // 7. Register user and create initial account atomically or with compensation
    let newUser;

    try {
      await runTransaction(async (session) => {
        const sessionOption = session ? { session } : undefined;

        // Create the user.
        const users = await User.create(
          [
            {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              aadhaarNo,
              email: normalizedEmail,
              passwordHash,
            },
          ],
          sessionOption
        );

        newUser = users[0];

        // Create a bank account with a unique account number.
        let accountCreated = false;

        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            await Account.create(
              [
                {
                  accountNo: generateAccountNumber(),
                  userId: newUser._id,
                  accountType: "SAVINGS",
                  balancePaise: 0,
                  status: "ACTIVE",
                },
              ],
              sessionOption
            );

            accountCreated = true;
            break;
          } catch (error) {
            // Retry only account-number duplicate collisions.
            if (
              error.code !== 11000 ||
              error.keyPattern?.accountNo !== 1 ||
              attempt === 4
            ) {
              throw error;
            }
          }
        }

        if (!accountCreated) {
          if (!session) {
            await User.findByIdAndDelete(newUser._id).catch(() => { });
          }
          throw new Error("Could not create a unique account number");
        }
      });

      // 8. Generate the token after successful registration.
      const token = generateToken(newUser._id.toString());
      try {
        await sendWelcomeEmail({
          to: newUser.email,
          firstName: newUser.firstName,
        });
      } catch (emailError) {
        console.error("Welcome email failed for user:", newUser._id.toString());
      }

      return res.status(201).json({
        success: true,
        message: "Registration successful",
        token,
        user: {
          id: newUser._id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
        },
      });
    } catch (error) {
      if (!supportsTransactions() && newUser?._id) {
        await User.findByIdAndDelete(newUser._id).catch(() => { });
      }
      throw error;
    }
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email or Aadhaar number is already registered",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

// ================= LOGIN =================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate required fields.
    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Find the user and explicitly include the password hash.
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 3. Verify the password.
    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // 4. Find the user's bank account.
    const account = await Account.findOne({
      userId: user._id,
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "No bank account is associated with this user",
      });
    }

    // 5. Verify that the account is active.
    if (account.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your bank account is not active",
      });
    }

    // 6. Generate the JWT.
    const token = generateToken(user._id.toString());

    // 7. Return the authenticated user and account information.
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      account: {
        accountNo: account.accountNo,
        accountType: account.accountType,
        balancePaise: account.balancePaise,
        status: account.status,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};
export const forgotPassword= async (req, res)=> {
  try{
    const {email }= req.body;
    if(typeof email !== "string" || !email.trim()){
      return res.status(400).json({
        success: false,
        message:"Email is required"
      })

    }
    const nor = email.trim().toLowerCase();
    const user = await User.findOne({
      email: nor
    })
    const responseMessage = "If an account exists with this email, a password reset link will be sent.";

    if(!user){
      return res.status(200).json({
        success: true,
        message: responseMessage,
      })
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetLink =`${frontendUrl}/reset-password?token=${resetToken}`;
    try {
      await sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        resetLink,
      });
    } catch (emailError) {
      // Clear the reset token if the email could not be sent.
      user.resetPasswordTokenHash = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: responseMessage,
    });

  }
  catch(error){
    console.error("Forgot password error:", error.message);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      message: "Unable to process the request. Please try again.",
    });
  }
  
};

// ================= RESET PASSWORD =================
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Validate input
    if (
      typeof token !== "string" ||
      !token.trim() ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid reset token and password of 8–72 characters are required.",
      });
    }

    // Hash the token to find its stored hash
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find the user whose reset token has not expired
    const user = await User.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordTokenHash +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset link.",
      });
    }

    // Hash the new password before saving
    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordChangedAt = new Date();
    // Make the reset link unusable after a successful reset
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset your password. Please try again.",
    });
  }
};

// ================= FORGOT ACCOUNT NUMBER =================
export const forgotAccount = async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

    // Generic response message to reduce account enumeration
    const responseMessage =
      "If an account is associated with this email, your account number has been sent.";

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    // Find the associated active bank account
    const account = await Account.findOne({
      userId: user._id,
      status: "ACTIVE",
    });

    if (!account) {
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    // Email the account number to the registered email address
    try {
      await sendAccountRecoveryEmail({
        to: user.email,
        firstName: user.firstName,
        accountNo: account.accountNo,
      });
    } catch (emailError) {
      // Do not expose account numbers or details in logs
      console.error(
        "Account recovery email delivery failed for user ID:",
        user._id.toString()
      );
    }

    // Never return the account number in the response
    return res.status(200).json({
      success: true,
      message: responseMessage,
    });
  } catch (error) {
    console.error("Forgot account error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process the request. Please try again.",
    });
  }
};

// ================= REFRESH SESSION =================
export const refreshSession = async (req, res) => {
  try {
    // Generates a fresh 15-minute token for the authenticated user
    const token = generateToken(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Session extended successfully",
      token,
    });
  } catch (error) {
    console.error("Refresh session error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to extend session",
    });
  }
};

