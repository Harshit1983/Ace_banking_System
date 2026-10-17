import { useState } from "react";
import api from "../services/api";

function ResetPassword({ token, onBackToLogin }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8 || password.length > 72) {
      setError("Password must be between 8 and 72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/reset-password", {
        token,
        password,
      });

      setSuccess(response.data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to reset your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bank-page">
      <main className="main-layout">
        <section className="auth-panel">
          <div className="auth-heading">
            <div className="auth-symbol">A</div>
            <h2>Reset Password</h2>
            <p>Choose a new password for your Ace Bank account.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                minLength={8}
                maxLength={72}
                required
              />
            </div>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            {!success && (
              <button
                className="submit-button"
                type="submit"
                disabled={loading || !token}
              >
                {loading ? "Resetting..." : "Reset Password →"}
              </button>
            )}
          </form>

          {success && (
            <button
              className="submit-button"
              type="button"
              onClick={onBackToLogin}
            >
              Back to Login
            </button>
          )}

          {!token && (
            <p className="message error">
              The reset token is missing. Please request a new reset link.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default ResetPassword;