
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import accountRoutes from "./routes/accountRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";

dotenv.config();

// Verify required environment variables at startup
export const validateEnvironment = () => {
  const missing = [];
  if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");
  if (!process.env.JWT_SECRET) {
    missing.push("JWT_SECRET");
  } else if (process.env.JWT_SECRET.length < 32) {
    console.warn("WARNING: JWT_SECRET should be at least 32 characters for production security.");
  }

  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variable(s): ${missing.join(", ")}`);
    process.exit(1);
  }
};

validateEnvironment();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Ace Bank MERN backend is running!",
  });
});

app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;

  if (!isDbConnected) {
    return res.status(503).json({
      success: false,
      message: "Database connection unavailable",
      database: "disconnected",
    });
  }

  res.status(200).json({
    success: true,
    message: "Ace Bank API is healthy",
    database: "connected",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/transfers", transferRoutes);

// Centralized error handling middleware
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Malformed JSON payload provided",
    });
  }

  console.error("Unhandled server error:", err.message);

  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Ace Bank server running at http://localhost:${PORT}`);
    });

    server.on("error", (err) => {
      console.error(`Server failed to start on port ${PORT}:`, err.message);
      process.exit(1);
    });

    return server;
  } catch (error) {
    console.error("Server startup aborted due to fatal error:", error.message);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export default app;