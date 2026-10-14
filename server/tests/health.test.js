import express from "express";
import request from "supertest";

const app = express();

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Ace Bank API is healthy",
  });
});

describe("Ace Bank API health check", () => {
  test("returns HTTP 200 and a healthy status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Ace Bank API is healthy");
  });
});