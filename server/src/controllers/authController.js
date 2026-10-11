
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Account from "../models/Account.js";

const generateAccountNumber = () => {
  // Generates a 10-digit customer-facing account number.
  return String(
    Math.floor(1000000000 + Math.random() * 9000000000)
  );
};

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

export const register = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { firstName, lastName, aadhaarNo, email, password } = req.body;

    if (
      !firstName?.trim() ||
      !lastName?.trim() ||
      !aadhaarNo ||
      !email?.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!/^\d{12}$/.test(aadhaarNo)) {
      return res.status(400).json({
        success: false,
        message: "Aadhaar number must contain exactly 12 digits",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address",
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8 to 72 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

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

    const passwordHash = await bcrypt.hash(password, 12);

    let newUser;

    await session.withTransaction(async () => {
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
        { session }
      );

      newUser = users[0];

      // Retry account-number generation if a collision occurs.
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
            { session }
          );

          accountCreated = true;
          break;
        } catch (error) {
          if (error.code !== 11000 || attempt === 4) {
            throw error;
          }
        }
      }

      if (!accountCreated) {
        throw new Error("Could not create a unique account number");
      }
    });

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
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email, Aadhaar number, or account number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  } finally {
    await session.endSession();
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Password hashes are excluded by default in User.js,
    // so explicitly request the hash for verification.
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Compare the entered password with the stored hash.
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

    // Find the customer's bank account.
    const account = await Account.findOne({
      userId: user._id,
    });

    if (!account) {
      return res.status(403).json({
        success: false,
        message: "No bank account is associated with this user",
      });
    }

    if (account.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your bank account is not active",
      });
    }

    const token = generateToken(user._id.toString());

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