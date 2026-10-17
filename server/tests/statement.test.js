import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/server.js";
import User from "../src/models/User.js";
import Account from "../src/models/Account.js";
import Transaction from "../src/models/Transaction.js";

dotenv.config();

describe("Feature 5: Downloadable Account Statement API", () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let accountA;
  let accountB;

  const userAData = {
    firstName: "StmtAlice",
    lastName: "Gupta",
    aadhaarNo: "445566778899",
    email: "stmt_alice@example.com",
    password: "Password123",
  };

  const userBData = {
    firstName: "StmtBob",
    lastName: "Singh",
    aadhaarNo: "223344556677",
    email: "stmt_bob@example.com",
    password: "Password123",
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    await User.deleteMany({ email: { $in: [userAData.email, userBData.email] } });

    const resA = await request(app).post("/api/auth/register").send(userAData);
    userAToken = resA.body.token;
    userAId = resA.body.user.id;
    accountA = await Account.findOne({ userId: userAId });

    const resB = await request(app).post("/api/auth/register").send(userBData);
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
    accountB = await Account.findOne({ userId: userBId });

    // Seed transactions for User A:
    // 1. Deposit 500
    await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ amount: "500", remark: "Initial deposit" });

    // 2. Withdraw 100 with a potentially malicious formula prefix
    await request(app)
      .post("/api/transactions/withdraw")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ amount: "100", remark: "=1+1 test formula injection" });

    // 3. Transfer 50 to User B
    await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        receiverAccountNo: accountB.accountNo,
        amount: "50",
        remark: "+100 bonus remark",
      });
  }, 25000);

  afterAll(async () => {
    const accIds = [accountA?._id, accountB?._id].filter(Boolean);
    await Transaction.deleteMany({
      $or: [{ senderAccount: { $in: accIds } }, { receiverAccount: { $in: accIds } }],
    });
    await Account.deleteMany({ _id: { $in: accIds } });
    await User.deleteMany({ _id: { $in: [userAId, userBId].filter(Boolean) } });
    await mongoose.disconnect();
  }, 25000);

  test("rejects unauthenticated request to statement endpoint", async () => {
    const res = await request(app).get("/api/transactions/statement");
    expect(res.status).toBe(401);
  });

  test("rejects statement when startDate is after endDate", async () => {
    const res = await request(app)
      .get("/api/transactions/statement?startDate=2026-10-15&endDate=2026-10-01")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("startDate cannot be after endDate");
  });

  test("rejects statement when date range exceeds 1 year", async () => {
    const res = await request(app)
      .get("/api/transactions/statement?startDate=2024-01-01&endDate=2025-06-01")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Date range cannot exceed 365 days");
  });

  test("downloads statement as CSV with proper headers and content", async () => {
    const res = await request(app)
      .get("/api/transactions/statement")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="ACE_Statement_.*\.csv"/);

    const csvText = res.text;
    expect(csvText).toContain("ACE Banking System - Official Account Statement");
    expect(csvText).toContain(accountA.accountNo);
    expect(csvText).toContain("StmtAlice Gupta");
    expect(csvText).toContain("Deposit");
    expect(csvText).toContain("Withdrawal");
    expect(csvText).toContain("Transfer Sent");

    // Check formula injection mitigation: cells starting with = or + should be prefixed with '
    expect(csvText).toContain("'=1+1 test formula injection");
    expect(csvText).toContain("'+100 bonus remark");
  });

  test("returns JSON format statement when requested", async () => {
    const res = await request(app)
      .get("/api/transactions/statement?format=json")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.statement).toBeDefined();
    expect(res.body.statement.accountNo).toBe(accountA.accountNo);
    expect(res.body.statement.totalTransactions).toBe(3);
    // User A: deposited 500, withdrew 100, transferred 50 => closing balance 350
    expect(res.body.statement.closingBalanceRupees).toBe(350);
  });

  test("User B statement contains only User B's transactions (isolation)", async () => {
    const res = await request(app)
      .get("/api/transactions/statement?format=json")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.statement.accountNo).toBe(accountB.accountNo);
    // User B only received 1 transfer of 50
    expect(res.body.statement.totalTransactions).toBe(1);
    expect(res.body.statement.closingBalanceRupees).toBe(50);
  });
});
