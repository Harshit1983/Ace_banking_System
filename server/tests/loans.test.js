import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/server.js";
import User from "../src/models/User.js";
import Account from "../src/models/Account.js";
import LoanApplication from "../src/models/LoanApplication.js";

dotenv.config();

describe("Feature 2: Loan Applications API", () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  const user1Data = {
    firstName: "LoanAlice",
    lastName: "Sharma",
    aadhaarNo: "112233445566",
    email: "loan_alice@example.com",
    password: "Password123",
  };

  const user2Data = {
    firstName: "LoanBob",
    lastName: "Verma",
    aadhaarNo: "998877665544",
    email: "loan_bob@example.com",
    password: "Password123",
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    await User.deleteMany({ email: { $in: [user1Data.email, user2Data.email] } });

    const res1 = await request(app).post("/api/auth/register").send(user1Data);
    user1Token = res1.body.token;
    user1Id = res1.body.user.id;

    const res2 = await request(app).post("/api/auth/register").send(user2Data);
    user2Token = res2.body.token;
    user2Id = res2.body.user.id;
  }, 25000);

  afterAll(async () => {
    await LoanApplication.deleteMany({ applicant: { $in: [user1Id, user2Id] } });
    await Account.deleteMany({ userId: { $in: [user1Id, user2Id] } });
    await User.deleteMany({ _id: { $in: [user1Id, user2Id] } });
    await mongoose.disconnect();
  }, 25000);

  test("rejects unauthenticated loan application", async () => {
    const res = await request(app)
      .post("/api/loans/apply")
      .send({
        loanType: "PERSONAL_LOAN",
        amount: 50000,
        monthlyIncome: 40000,
        employmentType: "SALARIED",
        employmentDurationMonths: 24,
        tenureMonths: 24,
      });

    expect(res.status).toBe(401);
  });

  test("rejects application with invalid loan type", async () => {
    const res = await request(app)
      .post("/api/loans/apply")
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        loanType: "GOLD_LOAN",
        amount: 50000,
        monthlyIncome: 40000,
        employmentType: "SALARIED",
        employmentDurationMonths: 24,
        tenureMonths: 24,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid loan type");
  });

  test("rejects personal loan amount exceeding maximum allowed limit", async () => {
    const res = await request(app)
      .post("/api/loans/apply")
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        loanType: "PERSONAL_LOAN",
        amount: 3000000, // 30 Lakhs > 25 Lakhs max
        monthlyIncome: 80000,
        employmentType: "SALARIED",
        employmentDurationMonths: 36,
        tenureMonths: 36,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Personal Loan amount must be between");
  });

  test("rejects personal loan tenure exceeding 60 months", async () => {
    const res = await request(app)
      .post("/api/loans/apply")
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        loanType: "PERSONAL_LOAN",
        amount: 50000,
        monthlyIncome: 30000,
        employmentType: "SALARIED",
        employmentDurationMonths: 12,
        tenureMonths: 72, // Exceeds 60 months
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("tenure must be between");
  });

  test("successfully submits a Personal Loan application with initial PENDING status", async () => {
    const res = await request(app)
      .post("/api/loans/apply")
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        loanType: "PERSONAL_LOAN",
        amount: 100000,
        monthlyIncome: 45000,
        employmentType: "SALARIED",
        employmentDurationMonths: 24,
        tenureMonths: 24,
        purpose: "Home renovation and electronics",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.application).toBeDefined();
    expect(res.body.application.applicationRef).toMatch(/^ACE-PL-/);
    expect(res.body.application.status).toBe("PENDING");
    expect(res.body.application.amountRupees).toBe(100000);
    expect(res.body.application.amountPaise).toBe(10000000);
  });

  test("successfully submits a Home Loan application", async () => {
    const res = await request(app)
      .post("/api/loans/apply")
      .set("Authorization", `Bearer ${user1Token}`)
      .send({
        loanType: "HOME_LOAN",
        amount: 4500000, // 45 Lakhs
        monthlyIncome: 95000,
        employmentType: "SALARIED",
        employmentDurationMonths: 48,
        tenureMonths: 240, // 20 years
        purpose: "Purchase of residential apartment",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.application.applicationRef).toMatch(/^ACE-HL-/);
    expect(res.body.application.status).toBe("PENDING");
  });

  test("User 1 views their own loan applications", async () => {
    const res = await request(app)
      .get("/api/loans/my-applications")
      .set("Authorization", `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.applications)).toBe(true);
    expect(res.body.applications.length).toBe(2);
  });

  test("User 2 cannot see User 1's loan applications (isolation)", async () => {
    const res = await request(app)
      .get("/api/loans/my-applications")
      .set("Authorization", `Bearer ${user2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.applications.length).toBe(0);
  });
});
