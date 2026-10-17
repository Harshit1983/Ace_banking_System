import { useEffect, useState, useId } from "react";
import api from "./services/api";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import LandingPage from "./pages/LandingPage";

function App() {
  const [authenticated, setAuthenticated] = useState(
    Boolean(localStorage.getItem("ace_bank_token"))
  );

  // Pages: "landing" | "login" | "register" | "forgot-password" | "forgot-account" | "dashboard"
  const [page, setPage] = useState(() => {
    if (localStorage.getItem("ace_bank_token")) return "dashboard";
    return "landing";
  });

  const [resetToken, setResetToken] = useState(
    new URLSearchParams(window.location.search).get("token") || ""
  );

  // Theme Management with OS Preference and LocalStorage persistence
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("ace_bank_theme");
    if (saved) return saved === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("ace_bank_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  function toggleDarkMode() {
    setDarkMode((prev) => !prev);
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Recovery States
  const [resetEmail, setResetEmail] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  // Registration & Login Form State
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    aadhaarNo: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Touched state for live per-field validation (Feature 8)
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  // Unique IDs for accessibility
  const firstNameErrorId = useId();
  const lastNameErrorId = useId();
  const aadhaarErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const confirmPasswordErrorId = useId();

  // Listen for global 401 unauthorized event (e.g. token expired or invalidated)
  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthenticated(false);
      setPage("login");
      setError("Your session has expired. Please log in again.");
      setSuccess("");
    };

    window.addEventListener("ace-bank-unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("ace-bank-unauthorized", handleUnauthorized);
    };
  }, []);

  // Validation function matching backend schema rules (Feature 8)
  function validateField(name, value, currentForm = form) {
    const cleanValue = typeof value === "string" ? value.trim() : "";

    switch (name) {
      case "firstName":
        if (!cleanValue) return "First name is required.";
        if (cleanValue.length > 50) return "First name cannot exceed 50 characters.";
        return "";

      case "lastName":
        if (!cleanValue) return "Last name is required.";
        if (cleanValue.length > 50) return "Last name cannot exceed 50 characters.";
        return "";

      case "aadhaarNo":
        if (!value) return "Aadhaar number is required.";
        if (!/^\d{12}$/.test(value.trim())) return "Aadhaar must contain exactly 12 digits.";
        return "";

      case "email":
        if (!cleanValue) return "Email address is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue.toLowerCase())) {
          return "Enter a valid email address (e.g. name@example.com).";
        }
        return "";

      case "password":
        if (!value) return "Password is required.";
        if (value.length < 8) return "Password must contain at least 8 characters.";
        if (value.length > 72) return "Password cannot exceed 72 characters.";
        return "";

      case "confirmPassword":
        if (!value) return "Please confirm your password.";
        if (value !== currentForm.password) return "Passwords do not match.";
        return "";

      default:
        return "";
    }
  }

  function handleBlur(event) {
    const { name, value } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({
      ...prev,
      [name]: validateField(name, value),
    }));
  }

  function handleChange(event) {
    const { name, value } = event.target;
    const updatedForm = { ...form, [name]: value };
    setForm(updatedForm);

    if (touched[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: validateField(name, value, updatedForm),
      }));
    }

    // If password changed, re-validate confirmPassword if touched
    if (name === "password" && touched.confirmPassword) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: validateField("confirmPassword", form.confirmPassword, updatedForm),
      }));
    }

    setError("");
  }

  // Check if entire registration form is valid
  const isRegistrationValid = () => {
    const errs = {
      firstName: validateField("firstName", form.firstName),
      lastName: validateField("lastName", form.lastName),
      aadhaarNo: validateField("aadhaarNo", form.aadhaarNo),
      email: validateField("email", form.email),
      password: validateField("password", form.password),
      confirmPassword: validateField("confirmPassword", form.confirmPassword),
    };
    return !Object.values(errs).some((msg) => msg !== "");
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    if (page === "register") {
      // Mark all fields as touched
      setTouched({
        firstName: true,
        lastName: true,
        aadhaarNo: true,
        email: true,
        password: true,
        confirmPassword: true,
      });

      const nextErrors = {
        firstName: validateField("firstName", form.firstName),
        lastName: validateField("lastName", form.lastName),
        aadhaarNo: validateField("aadhaarNo", form.aadhaarNo),
        email: validateField("email", form.email),
        password: validateField("password", form.password),
        confirmPassword: validateField("confirmPassword", form.confirmPassword),
      };

      setFieldErrors(nextErrors);

      if (Object.values(nextErrors).some((msg) => msg !== "")) {
        setError("Please fix the highlighted fields before submitting.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = page === "register" ? "/auth/register" : "/auth/login";

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
      localStorage.setItem("ace_bank_last_active", String(Date.now()));
      setAuthenticated(true);
      setPage("dashboard");

      setSuccess(
        page === "register"
          ? "Registration successful! Your account has been created."
          : "Login successful!"
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Unable to connect to the server. Please check your backend connection.";
      setError(msg);

      // Map backend duplicate field conflicts to live fields
      if (err.response?.status === 409) {
        if (msg.toLowerCase().includes("email")) {
          setFieldErrors((prev) => ({
            ...prev,
            email: "This email address is already registered.",
          }));
        }
        if (msg.toLowerCase().includes("aadhaar")) {
          setFieldErrors((prev) => ({
            ...prev,
            aadhaarNo: "This Aadhaar number is already registered.",
          }));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function switchPage(nextPage) {
    setPage(nextPage);
    setError("");
    setSuccess("");
    setFieldErrors({});
    setTouched({});
  }

  // Feature 1: Forgot Account Number Handler
  async function handleForgotAccount(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = recoveryEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-account", { email: cleanEmail });
      setSuccess(res.data.message);
      setRecoveryEmail("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to process your request. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  }

  // Forgot Password Handler
  async function handleForgotPassword(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = resetEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: cleanEmail });
      setSuccess(res.data.message);
      setResetEmail("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to process your request. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  }

  // URL Reset Password Route
  if (window.location.pathname === "/reset-password") {
    return (
      <ResetPassword
        token={resetToken}
        onBackToLogin={() => {
          window.history.replaceState({}, "", "/");
          setResetToken("");
          switchPage("login");
        }}
      />
    );
  }

  // Authenticated State -> Render Dashboard
  if (authenticated) {
    return (
      <Dashboard
        onLogout={() => {
          localStorage.removeItem("ace_bank_token");
          localStorage.removeItem("ace_bank_last_active");
          setAuthenticated(false);
          setPage("login");
          setForm({
            firstName: "",
            lastName: "",
            aadhaarNo: "",
            email: "",
            password: "",
            confirmPassword: "",
          });
          setError("");
          setSuccess("");
        }}
      />
    );
  }

  // Feature 6: Public Landing Page for non-logged-in visitors
  if (page === "landing") {
    return (
      <LandingPage
        onNavigateLogin={() => switchPage("login")}
        onNavigateRegister={() => switchPage("register")}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
    );
  }

  // Feature 1: Forgot Account Number Page
  if (page === "forgot-account") {
    return (
      <div className={`bank-page ${darkMode ? "dark-mode" : ""}`}>
        <header className="topbar">
          <div className="brand" onClick={() => switchPage("landing")} style={{ cursor: "pointer" }}>
            <div className="brand-icon">A</div>
            <div>
              <h2>Ace Bank</h2>
              <span>Banking made simple</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button type="button" className="theme-toggle" onClick={toggleDarkMode}>
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <button type="button" className="secondary-btn" onClick={() => switchPage("landing")}>
              ← Home
            </button>
          </div>
        </header>

        <main className="main-layout auth-single-layout">
          <section className="auth-panel">
            <div className="auth-heading">
              <div className="auth-symbol">A</div>
              <h2>Forgot Account Number?</h2>
              <p>
                Enter your registered email address. If an account is found, we will securely email your
                bank account number directly to your inbox.
              </p>
            </div>

            <form onSubmit={handleForgotAccount}>
              <div className="form-field">
                <label htmlFor="recoveryEmail">Registered Email Address</label>
                <input
                  id="recoveryEmail"
                  type="email"
                  autoComplete="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              {error && <div className="message error">{error}</div>}
              {success && <div className="message success">{success}</div>}

              <button
                className="submit-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Verifying & Sending..." : "Send My Account Number →"}
              </button>
            </form>

            <p className="switch-prompt">
              Remembered your account?{" "}
              <button type="button" onClick={() => switchPage("login")}>
                Back to login
              </button>
            </p>
          </section>
        </main>
      </div>
    );
  }

  // Forgot Password Page
  if (page === "forgot-password") {
    return (
      <div className={`bank-page ${darkMode ? "dark-mode" : ""}`}>
        <header className="topbar">
          <div className="brand" onClick={() => switchPage("landing")} style={{ cursor: "pointer" }}>
            <div className="brand-icon">A</div>
            <div>
              <h2>Ace Bank</h2>
              <span>Banking made simple</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button type="button" className="theme-toggle" onClick={toggleDarkMode}>
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <button type="button" className="secondary-btn" onClick={() => switchPage("landing")}>
              ← Home
            </button>
          </div>
        </header>

        <main className="main-layout auth-single-layout">
          <section className="auth-panel">
            <div className="auth-heading">
              <div className="auth-symbol">A</div>
              <h2>Forgot Password?</h2>
              <p>Enter your registered email to request a secure 15-minute password reset link.</p>
            </div>

            <form onSubmit={handleForgotPassword}>
              <div className="form-field">
                <label htmlFor="resetEmail">Registered Email Address</label>
                <input
                  id="resetEmail"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              {error && <div className="message error">{error}</div>}
              {success && <div className="message success">{success}</div>}

              <button
                className="submit-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending link..." : "Send Password Reset Link →"}
              </button>
            </form>

            <p className="switch-prompt">
              Remember your password?{" "}
              <button type="button" onClick={() => switchPage("login")}>
                Back to login
              </button>
            </p>
          </section>
        </main>
      </div>
    );
  }

  // Main Auth Flow: Login & Registration
  return (
    <div className={`bank-page ${darkMode ? "dark-mode" : ""}`}>
      <header className="topbar">
        <div className="brand" onClick={() => switchPage("landing")} style={{ cursor: "pointer" }}>
          <div className="brand-icon">A</div>
          <div>
            <h2>Ace Bank</h2>
            <span>Banking made simple</span>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={() => switchPage("landing")}
          >
            ← Public Home
          </button>

          <div className="secure-label">
            <span className="secure-dot"></span>
            Secure 256-Bit SSL
          </div>
        </div>
      </header>

      <main className="main-layout">
        <section className="welcome-panel">
          <span className="eyebrow">DIGITAL BANKING PORTAL</span>

          <h1>
            Banking that
            <br />
            moves with <span>you.</span>
          </h1>

          <p>
            Manage your account, track transactions, transfer funds atomically, download statements,
            and apply for loans through one seamless banking experience.
          </p>

          <div className="feature-list">
            <div className="feature">
              <span className="feature-icon">↗</span>
              <div>
                <strong>Atomic Money Transfers</strong>
                <p>Send funds with immediate ledger consistency.</p>
              </div>
            </div>

            <div className="feature">
              <span className="feature-icon">📊</span>
              <div>
                <strong>Certified Account Statements</strong>
                <p>Download custom date-range CSV statements anytime.</p>
              </div>
            </div>

            <div className="feature">
              <span className="feature-icon">🏠</span>
              <div>
                <strong>Home & Personal Loans</strong>
                <p>Apply online and track your application status.</p>
              </div>
            </div>
          </div>

          <div className="welcome-footer">
            ACE Banking System · Full-stack MERN with MongoDB Replica Set & 15-Minute Inactivity Protection.
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-heading">
            <div className="auth-symbol">A</div>

            <h2>{page === "login" ? "Welcome back" : "Create your account"}</h2>

            <p>
              {page === "login"
                ? "Enter your credentials to securely access your account."
                : "Fill in your details with live validation to get started."}
            </p>
          </div>

          <div className="tab-switch">
            <button
              type="button"
              className={page === "login" ? "tab active" : "tab"}
              onClick={() => switchPage("login")}
            >
              Sign In
            </button>

            <button
              type="button"
              className={page === "register" ? "tab active" : "tab"}
              onClick={() => switchPage("register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {page === "register" && (
              <>
                <div className="name-fields">
                  <div className="form-field">
                    <label htmlFor="firstName">
                      First Name
                      {touched.firstName && !fieldErrors.firstName && (
                        <span className="field-valid" aria-label="Valid first name">✓</span>
                      )}
                    </label>
                    <input
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g. Rahul"
                      maxLength={50}
                      aria-invalid={touched.firstName && Boolean(fieldErrors.firstName)}
                      aria-describedby={fieldErrors.firstName ? firstNameErrorId : undefined}
                      className={
                        touched.firstName
                          ? fieldErrors.firstName
                            ? "input-error"
                            : "input-valid"
                          : ""
                      }
                      required
                    />
                    {touched.firstName && fieldErrors.firstName && (
                      <small id={firstNameErrorId} className="field-error" role="alert">
                        {fieldErrors.firstName}
                      </small>
                    )}
                  </div>

                  <div className="form-field">
                    <label htmlFor="lastName">
                      Last Name
                      {touched.lastName && !fieldErrors.lastName && (
                        <span className="field-valid" aria-label="Valid last name">✓</span>
                      )}
                    </label>
                    <input
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g. Sharma"
                      maxLength={50}
                      aria-invalid={touched.lastName && Boolean(fieldErrors.lastName)}
                      aria-describedby={fieldErrors.lastName ? lastNameErrorId : undefined}
                      className={
                        touched.lastName
                          ? fieldErrors.lastName
                            ? "input-error"
                            : "input-valid"
                          : ""
                      }
                      required
                    />
                    {touched.lastName && fieldErrors.lastName && (
                      <small id={lastNameErrorId} className="field-error" role="alert">
                        {fieldErrors.lastName}
                      </small>
                    )}
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="aadhaarNo">
                    Aadhaar Number (12 Digits)
                    {touched.aadhaarNo && !fieldErrors.aadhaarNo && (
                      <span className="field-valid" aria-label="Valid Aadhaar format">✓</span>
                    )}
                  </label>
                  <input
                    id="aadhaarNo"
                    name="aadhaarNo"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.aadhaarNo}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="12-digit dummy test number"
                    maxLength={12}
                    aria-invalid={touched.aadhaarNo && Boolean(fieldErrors.aadhaarNo)}
                    aria-describedby={fieldErrors.aadhaarNo ? aadhaarErrorId : undefined}
                    className={
                      touched.aadhaarNo
                        ? fieldErrors.aadhaarNo
                          ? "input-error"
                          : "input-valid"
                        : ""
                    }
                    required
                  />
                  <small className="field-hint">Use test digits only. Never input real Aadhaar.</small>
                  {touched.aadhaarNo && fieldErrors.aadhaarNo && (
                    <small id={aadhaarErrorId} className="field-error" role="alert">
                      {fieldErrors.aadhaarNo}
                    </small>
                  )}
                </div>
              </>
            )}

            <div className="form-field">
              <label htmlFor="email">
                Email Address
                {page === "register" && touched.email && !fieldErrors.email && (
                  <span className="field-valid" aria-label="Valid email address">✓</span>
                )}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="you@example.com"
                aria-invalid={page === "register" && touched.email && Boolean(fieldErrors.email)}
                aria-describedby={page === "register" && fieldErrors.email ? emailErrorId : undefined}
                className={
                  page === "register" && touched.email
                    ? fieldErrors.email
                      ? "input-error"
                      : "input-valid"
                    : ""
                }
                required
              />
              {page === "register" && touched.email && fieldErrors.email && (
                <small id={emailErrorId} className="field-error" role="alert">
                  {fieldErrors.email}
                </small>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="password">
                Password
                {page === "register" && touched.password && !fieldErrors.password && (
                  <span className="field-valid" aria-label="Valid password length">✓</span>
                )}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={page === "login" ? "current-password" : "new-password"}
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={page === "login" ? "Enter your password" : "At least 8 characters"}
                minLength={8}
                maxLength={72}
                aria-invalid={page === "register" && touched.password && Boolean(fieldErrors.password)}
                aria-describedby={page === "register" && fieldErrors.password ? passwordErrorId : undefined}
                className={
                  page === "register" && touched.password
                    ? fieldErrors.password
                      ? "input-error"
                      : "input-valid"
                    : ""
                }
                required
              />
              {page === "register" && touched.password && fieldErrors.password && (
                <small id={passwordErrorId} className="field-error" role="alert">
                  {fieldErrors.password}
                </small>
              )}
            </div>

            {page === "register" && (
              <div className="form-field">
                <label htmlFor="confirmPassword">
                  Confirm Password
                  {touched.confirmPassword && !fieldErrors.confirmPassword && form.confirmPassword && (
                    <span className="field-valid" aria-label="Passwords match">✓</span>
                  )}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Re-enter your password"
                  minLength={8}
                  maxLength={72}
                  aria-invalid={touched.confirmPassword && Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? confirmPasswordErrorId : undefined}
                  className={
                    touched.confirmPassword
                      ? fieldErrors.confirmPassword
                        ? "input-error"
                        : "input-valid"
                      : ""
                  }
                  required
                />
                {touched.confirmPassword && fieldErrors.confirmPassword && (
                  <small id={confirmPasswordErrorId} className="field-error" role="alert">
                    {fieldErrors.confirmPassword}
                  </small>
                )}
              </div>
            )}

            {page === "login" && (
              <div className="login-helpers">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setRecoveryEmail(form.email);
                    switchPage("forgot-account");
                  }}
                >
                  Forgot Account Number?
                </button>

                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setResetEmail(form.email);
                    switchPage("forgot-password");
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {error && <div className="message error" role="alert">{error}</div>}
            {success && <div className="message success" role="status">{success}</div>}

            <button
              className="submit-button"
              type="submit"
              disabled={loading || (page === "register" && Object.keys(touched).length > 0 && !isRegistrationValid())}
            >
              {loading
                ? "Please wait..."
                : page === "login"
                ? "Sign in to your account →"
                : "Create bank account →"}
            </button>
          </form>

          <p className="switch-prompt">
            {page === "login" ? "New to Ace Bank?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchPage(page === "login" ? "register" : "login")}
            >
              {page === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>

          <div className="auth-note">
            Educational project. All transactions & accounts are simulated.
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;