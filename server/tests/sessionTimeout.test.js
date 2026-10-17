import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/server.js";
import User from "../src/models/User.js";
import Account from "../src/models/Account.js";

dotenv.config();

describe("Feature 7: Authentication Session & Token Lifecycle", () => {
  let userToken;
  let userId;

  const testUser = {
    firstName: "Session",
    lastName: "Tester",
    aadhaarNo: "334455667788",
    email: "session_tester@example.com",
    password: "Password123",
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    await User.deleteMany({ email: testUser.email });

    const res = await request(app).post("/api/auth/register").send(testUser);
    expect(res.status).toBe(201);
    userToken = res.body.token;
    userId = res.body.user.id;
  }, 25000);

  afterAll(async () => {
    await Account.deleteMany({ userId });
    await User.deleteMany({ _id: userId });
    await mongoose.disconnect();
  }, 25000);

  test("generated access token has a maximum expiration of 15 minutes", () => {
    const decoded = jwt.decode(userToken);
    expect(decoded).toBeDefined();
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();

    // 15 minutes = 900 seconds
    const lifetimeSeconds = decoded.exp - decoded.iat;
    expect(lifetimeSeconds).toBeLessThanOrEqual(900);
    expect(lifetimeSeconds).toBe(900);
  });

  test("backend rejects an expired token with 401", async () => {
    // Forge an expired token with same secret but exp in the past
    const expiredToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    );

    const res = await request(app)
      .get("/api/accounts/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("expired");
  });

  test("backend rejects tokens issued before passwordChangedAt with 401", async () => {
    // Generate a token timestamped now
    const oldToken = jwt.sign(
      { userId, iat: Math.floor(Date.now() / 1000) - 30 },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Update passwordChangedAt to now
    await User.findByIdAndUpdate(userId, { passwordChangedAt: new Date() });

    const res = await request(app)
      .get("/api/accounts/me")
      .set("Authorization", `Bearer ${oldToken}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Password changed");
  });

  test("refresh-session endpoint returns a fresh 15m token for authenticated user", async () => {
    // Create a fresh valid token
    const freshToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const res = await request(app)
      .post("/api/auth/refresh-session")
      .set("Authorization", `Bearer ${freshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    const decoded = jwt.decode(res.body.token);
    expect(decoded.exp - decoded.iat).toBe(900);
  });
});
