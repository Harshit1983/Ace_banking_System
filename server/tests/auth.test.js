import express from "express";
import request from "supertest";
import authRoutes from "../src/routes/authRoutes.js";

const app = express();

app.use(express.json());
app.use("/api/auth", authRoutes);

describe("ACE Bank authentication API", () => {
  test("rejects login when credentials are missing", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({});

    expect(response.status).toBe(400);
  });

  test("rejects registration when required fields are missing", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({});

    expect(response.status).toBe(400);
  });

  test("rejects registration with an invalid Aadhaar format", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        firstName: "Test",
        lastName: "User",
        aadhaarNo: "12345",
        email: "test@example.com",
        password: "TestPass123",
      });

    expect(response.status).toBe(400);
  });
});