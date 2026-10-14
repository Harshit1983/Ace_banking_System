
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Helper to mask sensitive credentials in connection URI for safe diagnostic logging
const maskUri = (uri) => {
  if (!uri) return "<undefined>";
  return uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
};

// Register connection lifecycle listeners once
mongoose.connection.on("connected", () => {
  console.log(`MongoDB connection established on ${mongoose.connection.host}:${mongoose.connection.port}`);
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected. Connection is unavailable.");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected successfully.");
});

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error("FATAL: MONGODB_URI environment variable is not defined.");
    process.exit(1);
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);
    console.log(`Database name: ${connection.connection.name}`);
    return connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error(`Attempted connection URI: ${maskUri(mongoUri)}`);

    if (error.message.includes("ECONNREFUSED")) {
      console.error(
        "Diagnostic: Connection refused on the specified port. Ensure the MongoDB service is active and listening on this address."
      );
    }

    process.exit(1);
  }
};

export default connectDB;