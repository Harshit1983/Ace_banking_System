import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/server.js";
import User from "../src/models/User.js";
import Account from "../src/models/Account.js";

dotenv.config();

describe("Feature 1: Forgot Account Number Recovery API", () => {
  const testUser = {
    firstName: "AccountRecovery",
    lastName: "Tester",
    aadhaarNo: "888877776666",
    email: "recovery_test@example.com",
    password: "Password123",
  };

  let createdUser;
  let userAccount;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    await User.deleteMany({ email: testUser.email });
    // Register test user
    const regRes = await request(app)
      .post("/api/auth/register")
      .send(testUser);
    expect(regRes.status).toBe(201);
    createdUser = regRes.body.user;

    userAccount = await Account.findOne({ userId: createdUser.id });
    expect(userAccount).not.toBeNull();
  }, 25000);

  afterAll(async () => {
    if (createdUser?.id) {
      await Account.deleteMany({ userId: createdUser.id });
      await User.deleteMany({ _id: createdUser.id });
    }
    await mongoose.disconnect();
  }, 25000);

  test("rejects request without email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-account")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Email is required");
  });

  test("rejects invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-account")
      .send({ email: "invalid-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("returns generic 200 response when email is not registered (prevents enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-account")
      .send({ email: "nonexistent_recovery@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("If an account is associated with this email");
    // Ensure account number is NOT returned in response
    expect(res.body.accountNo).toBeUndefined();
    expect(res.body.account).toBeUndefined();
  });

  test("returns generic 200 response for valid user and sends recovery email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-account")
      .send({ email: testUser.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("If an account is associated with this email");
    // Never expose account number in API response body
    expect(res.body.accountNo).toBeUndefined();
    expect(res.body.account).toBeUndefined();
  });
});
