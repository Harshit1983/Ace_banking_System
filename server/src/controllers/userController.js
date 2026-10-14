import bcrypt from "bcryptjs";
import User from "../models/User.js";

// ================= GET PROFILE =================
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "firstName lastName email createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve profile",
    });
  }
};

// ================= UPDATE PROFILE =================
export const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate firstName if provided
    if (firstName !== undefined) {
      if (
        typeof firstName !== "string" ||
        !firstName.trim() ||
        firstName.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "First name must be between 1 and 50 characters",
        });
      }
      user.firstName = firstName.trim();
    }

    // Validate lastName if provided
    if (lastName !== undefined) {
      if (
        typeof lastName !== "string" ||
        !lastName.trim() ||
        lastName.trim().length > 50
      ) {
        return res.status(400).json({
          success: false,
          message: "Last name must be between 1 and 50 characters",
        });
      }
      user.lastName = lastName.trim();
    }

    // Validate email if provided
    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid email address",
        });
      }

      // If email has changed, check for existing accounts with this email
      if (normalizedEmail !== user.email) {
        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: user._id },
        });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "Email address is already registered to another account",
          });
        }

        user.email = normalizedEmail;
      }
    }

    // Save only valid schema fields; protected fields (_id, aadhaarNo, passwordHash) cannot be injected
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email address is already registered to another account",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update profile",
    });
  }
};

// ================= CHANGE PASSWORD =================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // 1. Validate required inputs
    if (
      typeof currentPassword !== "string" ||
      !currentPassword ||
      typeof newPassword !== "string" ||
      !newPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    // 2. Validate confirmation if provided
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and password confirmation do not match",
      });
    }

    // 3. Validate new password length policy (consistent with registration: 8 to 72 chars)
    if (newPassword.length < 8 || newPassword.length > 72) {
      return res.status(400).json({
        success: false,
        message: "New password must contain 8 to 72 characters",
      });
    }

    // 4. Retrieve user with password hash
    const user = await User.findById(req.user.id).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 5. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // 6. Ensure new password is not identical to current password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from your current password",
      });
    }

    // 7. Hash the new password and save
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newPasswordHash;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to change password",
    });
  }
};
