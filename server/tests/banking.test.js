import dotenv from "dotenv";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/server.js";
import User from "../src/models/User.js";
import Account from "../src/models/Account.js";
import Transaction from "../src/models/Transaction.js";

dotenv.config();

describe("ACE Bank End-to-End Banking Integration", () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let userAAccountNo;
  let userBAccountNo;

  const userAData = {
    firstName: "TestAlice",
    lastName: "User",
    aadhaarNo: "777788889999",
    email: "testalice@example.com",
    password: "Password123",
  };

  const userBData = {
    firstName: "TestBob",
    lastName: "User",
    aadhaarNo: "555566667777",
    email: "testbob@example.com",
    password: "Password123",
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    // Clean up test data
    await User.deleteMany({ email: { $in: [userAData.email, userBData.email] } });
  }, 25000);

  afterAll(async () => {
    // Clean up all artifacts created during testing
    await User.deleteMany({ email: { $in: [userAData.email, userBData.email] } });
    if (userAId || userBId) {
      const accounts = await Account.find({
        userId: { $in: [userAId, userBId].filter(Boolean) },
      });
      const accountIds = accounts.map((a) => a._id);
      await Account.deleteMany({ _id: { $in: accountIds } });
      await Transaction.deleteMany({
        $or: [
          { senderAccount: { $in: accountIds } },
          { receiverAccount: { $in: accountIds } },
        ],
      });
    }
    await mongoose.disconnect();
  }, 25000);

  test("Health check endpoint reports database connected", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.database).toBe("connected");
  });

  test("Registers User A and automatically creates an active bank account", async () => {
    const res = await request(app).post("/api/auth/register").send(userAData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    userAToken = res.body.token;
    userAId = res.body.user.id;

    // Check account exists
    const account = await Account.findOne({ userId: userAId });
    expect(account).not.toBeNull();
    expect(account.status).toBe("ACTIVE");
    expect(account.balancePaise).toBe(0);
    userAAccountNo = account.accountNo;
  });

  test("Registers User B and automatically creates an active bank account", async () => {
    const res = await request(app).post("/api/auth/register").send(userBData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    userBToken = res.body.token;
    userBId = res.body.user.id;

    const account = await Account.findOne({ userId: userBId });
    expect(account).not.toBeNull();
    expect(account.status).toBe("ACTIVE");
    userBAccountNo = account.accountNo;
  });

  test("User A deposits ₹500 successfully", async () => {
    const res = await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ amount: "500" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balanceRupees).toBe(500);

    const account = await Account.findOne({ userId: userAId });
    expect(account.balancePaise).toBe(50000);
  });

  test("User A withdraws ₹100 successfully", async () => {
    const res = await request(app)
      .post("/api/transactions/withdraw")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ amount: "100" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balanceRupees).toBe(400);

    const account = await Account.findOne({ userId: userAId });
    expect(account.balancePaise).toBe(40000);
  });

  test("User A transfers ₹150 to User B successfully", async () => {
    const res = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        receiverAccountNo: userBAccountNo,
        amount: "150",
        remark: "Test transfer",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.senderBalanceRupees).toBe(250);

    // Verify User A balance: 400 - 150 = 250
    const accA = await Account.findOne({ userId: userAId });
    expect(accA.balancePaise).toBe(25000);

    // Verify User B balance: 0 + 150 = 150
    const accB = await Account.findOne({ userId: userBId });
    expect(accB.balancePaise).toBe(15000);
  });

  test("User A cannot transfer to non-existent account", async () => {
    const res = await request(app)
      .post("/api/transfers")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        receiverAccountNo: "9999999999",
        amount: "50",
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("User A fetches transaction history with pagination", async () => {
    const res = await request(app)
      .get("/api/transactions/history?page=1&limit=10")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    expect(res.body.transactions.length).toBe(3);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.totalRecords).toBe(3);
  });

  test("User A retrieves and updates profile", async () => {
    // 1. Get profile
    const getRes = await request(app)
      .get("/api/users/profile")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.user.firstName).toBe("TestAlice");

    // 2. Update profile
    const updateRes = await request(app)
      .put("/api/users/profile")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ firstName: "AliceUpdated", lastName: "UserUpdated" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.user.firstName).toBe("AliceUpdated");
    expect(updateRes.body.user.lastName).toBe("UserUpdated");
  });

  test("User A changes password and logs in with new password", async () => {
    // 1. Change password
    const changeRes = await request(app)
      .put("/api/users/change-password")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        currentPassword: userAData.password,
        newPassword: "NewSecretPassword123",
        confirmPassword: "NewSecretPassword123",
      });

    expect(changeRes.status).toBe(200);
    expect(changeRes.body.success).toBe(true);

    // 2. Login with old password should fail
    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: userAData.email, password: userAData.password });

    expect(oldLoginRes.status).toBe(401);

    // 3. Login with new password should succeed
    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: userAData.email, password: "NewSecretPassword123" });

    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.success).toBe(true);
    expect(newLoginRes.body.token).toBeDefined();
  });
  
  test("Concurrent withdrawals cannot exceed the ₹500 daily limit", async () => {
    const account = await Account.findOne({ userId: userBId });
    expect(account).not.toBeNull();

    // Seed a test-only withdrawal record of ₹499 for today.
    // User B is created specifically for this integration test suite.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    await Transaction.create({
      senderAccount: account._id,
      receiverAccount: null,
      amountPaise: 49900,
      txType: "WITHDRAWAL",
      remark: "Concurrency test seed",
    });

    const results = await Promise.all([
      request(app)
        .post("/api/transactions/withdraw")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({ amount: "1" }),
      request(app)
        .post("/api/transactions/withdraw")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({ amount: "1" }),
    ]);

    // Exactly one ₹1 withdrawal should succeed.
    const successful = results.filter((res) => res.status === 200);
    expect(successful).toHaveLength(1);

    // The other request should be rejected by the daily limit.
    const rejected = results.filter((res) => res.status === 400);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].body.message).toContain("Daily withdrawal limit");

    // Verify the actual database total for today's withdrawals.
    const transactions = await Transaction.find({
      senderAccount: account._id,
      txType: "WITHDRAWAL",
      createdAt: { $gte: todayStart },
    });

    const totalWithdrawnPaise = transactions.reduce(
      (total, transaction) => total + transaction.amountPaise,
      0
    );

    expect(totalWithdrawnPaise).toBeLessThanOrEqual(50000);
    expect(totalWithdrawnPaise).toBe(50000);

    // Verify only the successful request debited the account.
    const updatedAccount = await Account.findById(account._id);
    expect(updatedAccount.balancePaise).toBe(account.balancePaise - 100);
  });

});
