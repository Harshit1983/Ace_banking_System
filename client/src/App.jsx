import { useEffect, useState } from "react";
import api from "./services/api";
import "./App.css";
import Dashboard from "./pages/Dashboard";

function App() {
  const [page, setPage] = useState(
    localStorage.getItem("ace_bank_token") ? "dashboard" : "login"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");



  const [authenticated, setAuthenticated] = useState(
    Boolean(localStorage.getItem("ace_bank_token"))
  );

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    aadhaarNo: "",
    email: "",
    password: "",
  });
  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthenticated(false);
      setPage("login");
      setError("Your session has expired. Please log in again.");
      setSuccess("");
    };

    window.addEventListener(
      "ace-bank-unauthorized",
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        "ace-bank-unauthorized",
        handleUnauthorized
      );
    };
  }, []);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    if (page === "register") {
      const cleanFirst = form.firstName.trim();
      const cleanLast = form.lastName.trim();
      const cleanAadhaar = form.aadhaarNo.trim();

      if (!cleanFirst || cleanFirst.length > 50) {
        setError("First name must be between 1 and 50 characters.");
        return;
      }
      if (!cleanLast || cleanLast.length > 50) {
        setError("Last name must be between 1 and 50 characters.");
        return;
      }
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        setError("Aadhaar number must contain exactly 12 digits.");
        return;
      }
      if (form.password.length < 8 || form.password.length > 72) {
        setError("Password must contain 8 to 72 characters.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint =
        page === "register" ? "/auth/register" : "/auth/login";

      const payload =
        page === "register"
          ? {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              aadhaarNo: form.aadhaarNo.trim(),
              email: form.email.trim(),
              password: form.password,
            }
          : {
              email: form.email.trim(),
              password: form.password,
            };

      const response = await api.post(endpoint, payload);

      localStorage.setItem("ace_bank_token", response.data.token);
      setAuthenticated(true);

      setSuccess(
        page === "register"
          ? "Registration successful! Your account has been created."
          : "Login successful!"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to connect to the server. Please check your backend."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchPage(nextPage) {
    setPage(nextPage);
    setError("");
    setSuccess("");
  }
  if (authenticated) {
    return (
      <Dashboard
        onLogout={() => {
          localStorage.removeItem("ace_bank_token");
          setAuthenticated(false);
          setPage("login");
          setForm({
            firstName: "",
            lastName: "",
            aadhaarNo: "",
            email: "",
            password: "",
          });
          setError("");
          setSuccess("");
        }}
      />
    );
  }

  return (
    <div className="bank-page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <h2>Ace Bank</h2>
            <span>Banking made simple</span>
          </div>
        </div>

        <div className="secure-label">
          <span className="secure-dot"></span>
          Secure Banking Portal
        </div>
      </header>

      <main className="main-layout">
        <section className="welcome-panel">
          <span className="eyebrow">YOUR MONEY. YOUR CONTROL.</span>

          <h1>
            Banking that
            <br />
            moves with <span>you.</span>
          </h1>

          <p>
            Manage your account, track transactions, and transfer
            money through one simple banking experience.
          </p>

          <div className="feature-list">
            <div className="feature">
              <span className="feature-icon">↗</span>
              <div>
                <strong>Easy transfers</strong>
                <p>Send money with a few simple steps.</p>
              </div>
            </div>

            <div className="feature">
              <span className="feature-icon">₹</span>
              <div>
                <strong>Clear account overview</strong>
                <p>Keep your balance and activity organized.</p>
              </div>
            </div>

            <div className="feature">
              <span className="feature-icon">✓</span>
              <div>
                <strong>Account protection</strong>
                <p>Authentication backed by your bank API.</p>
              </div>
            </div>
          </div>

          <div className="welcome-footer">
            A learning project built with React, Express and MongoDB.
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-heading">
            <div className="auth-symbol">A</div>

            <h2>
              {page === "login" ? "Welcome back" : "Create your account"}
            </h2>

            <p>
              {page === "login"
                ? "Enter your details to access your account."
                : "Fill in your details to get started with Ace Bank."}
            </p>
          </div>

          <div className="tab-switch">
            <button
              type="button"
              className={page === "login" ? "tab active" : "tab"}
              onClick={() => switchPage("login")}
            >
              Sign in
            </button>

            <button
              type="button"
              className={page === "register" ? "tab active" : "tab"}
              onClick={() => switchPage("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {page === "register" && (
              <>
                <div className="name-fields">
                  <div className="form-field">
                    <label htmlFor="firstName">First name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      placeholder="First name"
                      maxLength={50}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="lastName">Last name</label>
                    <input
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      placeholder="Last name"
                      maxLength={50}
                      required
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="aadhaarNo">Aadhaar number</label>
                  <input
                    id="aadhaarNo"
                    name="aadhaarNo"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.aadhaarNo}
                    onChange={handleChange}
                    placeholder="12-digit test number"
                    pattern="[0-9]{12}"
                    maxLength={12}
                    required
                  />
                  <small>Use dummy test data, not your real Aadhaar.</small>
                </div>
              </>
            )}

            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  page === "login" ? "current-password" : "new-password"
                }
                value={form.password}
                onChange={handleChange}
                placeholder={
                  page === "login"
                    ? "Enter your password"
                    : "At least 8 characters"
                }
                minLength={8}
                maxLength={72}
                required
              />
            </div>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <button className="submit-button" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : page === "login"
                  ? "Sign in to your account →"
                  : "Create bank account →"}
            </button>
          </form>

          <p className="switch-prompt">
            {page === "login"
              ? "New to Ace Bank?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() =>
                switchPage(page === "login" ? "register" : "login")
              }
            >
              {page === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="auth-note">
            This is a student banking project. Do not use real financial or
            identity information.
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;