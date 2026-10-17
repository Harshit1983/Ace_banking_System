import { useState, useEffect, useCallback } from "react";
import api from "../services/api";

function formatINR(val) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(val) || 0);
}

const LOAN_RULES = {
  PERSONAL_LOAN: {
    name: "Personal Loan",
    minAmount: 10000,
    maxAmount: 2500000,
    minTenure: 6,
    maxTenure: 60,
    minIncome: 15000,
    description: "Quick personal loans for medical, travel, wedding, or home renovation needs.",
  },
  HOME_LOAN: {
    name: "Home Loan",
    minAmount: 100000,
    maxAmount: 100000000,
    minTenure: 12,
    maxTenure: 360,
    minIncome: 25000,
    description: "Competitive home financing for purchase, construction, or plot development.",
  },
};

export default function LoanSection({ user }) {
  const [activeTab, setActiveTab] = useState("apply"); // "apply" | "history"
  const [loanType, setLoanType] = useState("PERSONAL_LOAN");
  const [amount, setAmount] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [employmentType, setEmploymentType] = useState("SALARIED");
  const [employmentDuration, setEmploymentDuration] = useState("24");
  const [tenureMonths, setTenureMonths] = useState("24");
  const [purpose, setPurpose] = useState("");

  const [applications, setApplications] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submittedApp, setSubmittedApp] = useState(null);

  const currentRules = LOAN_RULES[loanType];

  const fetchApplications = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get("/loans/my-applications");
      setApplications(response.data.applications || []);
    } catch (err) {
      console.error("Failed to load loan applications:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api
      .get("/loans/my-applications")
      .then((res) => {
        if (!ignore) {
          setApplications(res.data.applications || []);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to load loan applications:", err);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingHistory(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleLoanTypeSelect = (type) => {
    setLoanType(type);
    setError("");
    setSuccessMessage("");
    setSubmittedApp(null);
    // Set appropriate default tenure
    setTenureMonths(type === "HOME_LOAN" ? "120" : "24");
  };

  const validateForm = () => {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < currentRules.minAmount || numAmount > currentRules.maxAmount) {
      setError(`Amount must be between ${formatINR(currentRules.minAmount)} and ${formatINR(currentRules.maxAmount)}.`);
      return false;
    }

    const numIncome = Number(monthlyIncome);
    if (!Number.isFinite(numIncome) || numIncome < currentRules.minIncome) {
      setError(`Monthly income must be at least ${formatINR(currentRules.minIncome)}.`);
      return false;
    }

    const numDuration = parseInt(employmentDuration, 10);
    if (isNaN(numDuration) || numDuration < 0) {
      setError("Please enter a valid employment duration in months.");
      return false;
    }

    const numTenure = parseInt(tenureMonths, 10);
    if (isNaN(numTenure) || numTenure < currentRules.minTenure || numTenure > currentRules.maxTenure) {
      setError(`Loan tenure must be between ${currentRules.minTenure} and ${currentRules.maxTenure} months.`);
      return false;
    }

    setError("");
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setError("");
    setSuccessMessage("");
    setSubmittedApp(null);

    try {
      const response = await api.post("/loans/apply", {
        loanType,
        amount: String(amount).trim(),
        monthlyIncome: String(monthlyIncome).trim(),
        employmentType,
        employmentDurationMonths: employmentDuration,
        tenureMonths,
        purpose: purpose.trim(),
      });

      setSuccessMessage(response.data.message);
      setSubmittedApp(response.data.application);
      // Refresh applications list
      fetchApplications();

      // Reset form
      setAmount("");
      setMonthlyIncome("");
      setPurpose("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to submit loan application. Please review your details and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="loan-panel">
      <div className="loan-header">
        <div>
          <h2>ACE Financing & Loans</h2>
          <p>Explore competitive Home & Personal Loan offerings with transparent terms.</p>
        </div>

        <div className="loan-tabs">
          <button
            type="button"
            className={activeTab === "apply" ? "loan-tab active" : "loan-tab"}
            onClick={() => setActiveTab("apply")}
          >
            Apply for Loan
          </button>
          <button
            type="button"
            className={activeTab === "history" ? "loan-tab active" : "loan-tab"}
            onClick={() => {
              setActiveTab("history");
              fetchApplications();
            }}
          >
            My Applications ({applications.length})
          </button>
        </div>
      </div>

      {activeTab === "apply" ? (
        <div className="loan-apply-container">
          {/* Loan Product Selector Cards */}
          <div className="loan-product-selector">
            <div
              className={`product-card ${loanType === "PERSONAL_LOAN" ? "selected" : ""}`}
              onClick={() => handleLoanTypeSelect("PERSONAL_LOAN")}
            >
              <div className="product-icon">💼</div>
              <div className="product-info">
                <h3>Personal Loan</h3>
                <p>Up to ₹25 Lakhs · 6 to 60 Months</p>
                <span className="product-badge">Immediate Processing</span>
              </div>
            </div>

            <div
              className={`product-card ${loanType === "HOME_LOAN" ? "selected" : ""}`}
              onClick={() => handleLoanTypeSelect("HOME_LOAN")}
            >
              <div className="product-icon">🏠</div>
              <div className="product-info">
                <h3>Home Loan</h3>
                <p>Up to ₹10 Crores · Up to 30 Years</p>
                <span className="product-badge">Attractive Rates</span>
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {submittedApp && (
            <div className="loan-success-banner">
              <div className="success-icon">✓</div>
              <div className="success-details">
                <strong>Application Successfully Submitted!</strong>
                <p>{successMessage}</p>
                <div className="ref-tag">
                  Reference ID: <strong>{submittedApp.applicationRef}</strong>
                </div>
                <small>
                  A confirmation email has been dispatched to {user?.email}. Your application is currently{" "}
                  <strong className="status-badge">PENDING REVIEW</strong> by our underwriting team.
                </small>
              </div>
            </div>
          )}

          {error && <div className="message error">{error}</div>}

          {/* Application Form */}
          <form className="loan-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="loanAmount">
                  Requested Amount (₹)
                  <span className="field-hint">
                    ({formatINR(currentRules.minAmount)} to {formatINR(currentRules.maxAmount)})
                  </span>
                </label>
                <input
                  id="loanAmount"
                  type="number"
                  min={currentRules.minAmount}
                  max={currentRules.maxAmount}
                  step="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`e.g. ${currentRules.minAmount}`}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="monthlyIncome">
                  Applicant's Monthly Income (₹)
                  <span className="field-hint">(Min {formatINR(currentRules.minIncome)})</span>
                </label>
                <input
                  id="monthlyIncome"
                  type="number"
                  min={currentRules.minIncome}
                  step="1000"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  placeholder="e.g. 50000"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="employmentType">Employment Type</label>
                <select
                  id="employmentType"
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                >
                  <option value="SALARIED">Salaried Employee</option>
                  <option value="SELF_EMPLOYED">Self-Employed Professional</option>
                  <option value="BUSINESS">Business Owner</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="employmentDuration">Employment Duration (Months)</label>
                <input
                  id="employmentDuration"
                  type="number"
                  min="0"
                  max="600"
                  value={employmentDuration}
                  onChange={(e) => setEmploymentDuration(e.target.value)}
                  placeholder="e.g. 24"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="loanTenure">
                  Loan Tenure (Months)
                  <span className="field-hint">
                    ({currentRules.minTenure}–{currentRules.maxTenure} months)
                  </span>
                </label>
                <input
                  id="loanTenure"
                  type="number"
                  min={currentRules.minTenure}
                  max={currentRules.maxTenure}
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value)}
                  placeholder="e.g. 24"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="applicantContact">Applicant Contact (Verified Account)</label>
                <input
                  id="applicantContact"
                  type="text"
                  value={`${user?.firstName || ""} ${user?.lastName || ""} (${user?.email || ""})`}
                  disabled
                  readOnly
                  className="read-only-input"
                />
              </div>
            </div>

            <div className="form-field full-width">
              <label htmlFor="loanPurpose">Purpose / Additional Information (Optional)</label>
              <textarea
                id="loanPurpose"
                rows={3}
                maxLength={500}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Briefly describe the purpose of the requested loan..."
              />
            </div>

            <div className="loan-disclaimer">
              <p>
                <strong>Underwriting Notice:</strong> Submitting this application does not imply loan approval.
                All applications are subject to credit verification and banking policy standards. No processing fees
                or sensitive passwords are ever requested via email or phone.
              </p>
            </div>

            <button
              type="submit"
              className="submit-button loan-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Submitting Application..." : `Submit ${currentRules.name} Application →`}
            </button>
          </form>
        </div>
      ) : (
        /* Applications History Tab */
        <div className="loan-history-container">
          {loadingHistory ? (
            <div className="dashboard-loading">Loading your loan applications...</div>
          ) : applications.length === 0 ? (
            <div className="empty-transactions">
              <div className="empty-icon">📄</div>
              <h3>No Loan Applications Submitted</h3>
              <p>You haven't submitted any loan applications yet. Choose a product above to get started.</p>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setActiveTab("apply")}
              >
                Apply for a Loan Now
              </button>
            </div>
          ) : (
            <div className="applications-table-wrapper">
              <table className="loan-table">
                <thead>
                  <tr>
                    <th>Reference ID</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Tenure</th>
                    <th>Status</th>
                    <th>Submitted On</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id || app.applicationRef}>
                      <td>
                        <strong className="ref-code">{app.applicationRef}</strong>
                      </td>
                      <td>{app.loanType === "HOME_LOAN" ? "Home Loan" : "Personal Loan"}</td>
                      <td>
                        <strong className="loan-amount-cell">{formatINR(app.amountRupees)}</strong>
                      </td>
                      <td>{app.tenureMonths} Months</td>
                      <td>
                        <span className={`status-pill ${String(app.status).toLowerCase()}`}>
                          {app.status || "PENDING"}
                        </span>
                      </td>
                      <td>
                        {app.createdAt ? new Date(app.createdAt).toLocaleDateString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
