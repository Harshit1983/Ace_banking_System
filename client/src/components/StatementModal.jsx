import { useState } from "react";
import api from "../services/api";

function formatINR(val) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(val) || 0);
}

const formatDateInput = (date) => date.toISOString().split("T")[0];

export default function StatementModal({ isOpen, onClose, accountNumber }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [maxDate] = useState(() => formatDateInput(new Date()));
  const [preset, setPreset] = useState("30");
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handlePresetChange = (days) => {
    setPreset(String(days));
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
    setPreviewData(null);
    setError("");
  };

  const validateDates = () => {
    if (!startDate || !endDate) {
      setError("Please select both a start date and an end date.");
      return false;
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (s > e) {
      setError("Start date cannot be after end date.");
      return false;
    }
    const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 365) {
      setError("Statement date range cannot exceed 365 days (1 year).");
      return false;
    }
    setError("");
    return true;
  };

  const handleDownload = async () => {
    if (!validateDates()) return;
    setDownloading(true);
    setError("");

    try {
      const response = await api.get("/transactions/statement", {
        params: { startDate, endDate, format: "csv" },
        responseType: "blob",
      });

      // Extract filename from Content-Disposition header if available
      let filename = `ACE_Statement_${startDate}_to_${endDate}.csv`;
      const disposition = response.headers["content-disposition"];
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      // Trigger browser download
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Statement download failed:", err);
      setError(
        err.response?.data?.message ||
          "Unable to download account statement. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async () => {
    if (!validateDates()) return;
    setPreviewing(true);
    setError("");

    try {
      const response = await api.get("/transactions/statement", {
        params: { startDate, endDate, format: "json" },
      });
      setPreviewData(response.data.statement);
    } catch (err) {
      console.error("Statement preview failed:", err);
      setError(
        err.response?.data?.message || "Unable to load statement preview."
      );
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-title"
      onClick={onClose}
    >
      <div
        className="modal-dialog statement-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 id="statement-title">Account Statement</h3>
            <span className="modal-subtitle">
              Download certified activity for Account #{accountNumber}
            </span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body statement-body">
          {/* Quick preset buttons */}
          <div className="statement-presets">
            <span>Quick Range:</span>
            <div className="preset-buttons">
              <button
                type="button"
                className={preset === "30" ? "preset-btn active" : "preset-btn"}
                onClick={() => handlePresetChange(30)}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                className={preset === "90" ? "preset-btn active" : "preset-btn"}
                onClick={() => handlePresetChange(90)}
              >
                Last 3 Months
              </button>
              <button
                type="button"
                className={preset === "180" ? "preset-btn active" : "preset-btn"}
                onClick={() => handlePresetChange(180)}
              >
                Last 6 Months
              </button>
              <button
                type="button"
                className={preset === "365" ? "preset-btn active" : "preset-btn"}
                onClick={() => handlePresetChange(365)}
              >
                Last 1 Year
              </button>
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="statement-date-inputs">
            <div className="form-field">
              <label htmlFor="stmtStartDate">From Date</label>
              <input
                id="stmtStartDate"
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreset("custom");
                  setPreviewData(null);
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="stmtEndDate">To Date</label>
              <input
                id="stmtEndDate"
                type="date"
                value={endDate}
                min={startDate}
                max={maxDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPreset("custom");
                  setPreviewData(null);
                }}
              />
            </div>
          </div>

          {error && <div className="message error">{error}</div>}

          {/* Action buttons */}
          <div className="statement-actions">
            <button
              type="button"
              className="submit-button primary-btn"
              onClick={handleDownload}
              disabled={downloading || previewing}
            >
              {downloading ? "Generating CSV..." : "⬇ Download CSV Statement"}
            </button>

            <button
              type="button"
              className="secondary-btn"
              onClick={handlePreview}
              disabled={downloading || previewing}
            >
              {previewing ? "Loading..." : "👁 Preview On-Screen"}
            </button>
          </div>

          {/* Statement Preview Block */}
          {previewData && (
            <div className="statement-preview-card">
              <h4>Statement Summary ({previewData.period.startDate} to {previewData.period.endDate})</h4>
              <div className="statement-metrics-grid">
                <div className="metric-box">
                  <span>Opening Balance</span>
                  <strong>{formatINR(previewData.openingBalanceRupees)}</strong>
                </div>
                <div className="metric-box">
                  <span>Total Deposits/Credits</span>
                  <strong className="amount-credit">+{formatINR(previewData.totalCreditRupees)}</strong>
                </div>
                <div className="metric-box">
                  <span>Total Debits/Transfers</span>
                  <strong className="amount-debit">−{formatINR(previewData.totalDebitRupees)}</strong>
                </div>
                <div className="metric-box">
                  <span>Closing Balance</span>
                  <strong>{formatINR(previewData.closingBalanceRupees)}</strong>
                </div>
              </div>

              <div className="preview-table-container">
                <table className="statement-preview-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                          No transactions found in this date range.
                        </td>
                      </tr>
                    ) : (
                      previewData.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{tx.date.split(" ")[0]}</td>
                          <td><strong>{tx.type}</strong></td>
                          <td>{tx.details || tx.remark}</td>
                          <td className="amount-debit">{tx.debitRupees ? `−₹${tx.debitRupees}` : "—"}</td>
                          <td className="amount-credit">{tx.creditRupees ? `+₹${tx.creditRupees}` : "—"}</td>
                          <td><strong>₹{tx.balanceRupees}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
