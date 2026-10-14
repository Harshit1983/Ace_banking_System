import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Account from "../models/Account.js";
import { runTransaction, supportsTransactions } from "../utils/transactionRunner.js";

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
    { expiresIn: "1d" }
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
            await User.findByIdAndDelete(newUser._id).catch(() => {});
          }
          throw new Error("Could not create a unique account number");
        }
      });

      // 8. Generate the token after successful registration.
      const token = generateToken(newUser._id.toString());

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
        await User.findByIdAndDelete(newUser._id).catch(() => {});
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
