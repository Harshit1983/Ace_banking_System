import { useEffect, useState, useCallback } from "react";
import api from "../services/api";

function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function Dashboard({ onLogout }) {
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Money action form state
  const [transactionType, setTransactionType] = useState("deposit"); // "deposit" | "withdraw" | "transfer"
  const [amount, setAmount] = useState("");
  const [receiverAccountNo, setReceiverAccountNo] = useState("");
  const [remark, setRemark] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Transaction history filtering & pagination state
  const [historyType, setHistoryType] = useState("ALL");
  const [historyPage, setHistoryPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalRecords: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("profile"); // "profile" | "password"

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Fetch transactions with pagination and filter
  const fetchTransactions = useCallback(
    async (type = historyType, page = historyPage, start = startDate, end = endDate) => {
      try {
        const params = new URLSearchParams();
        if (type && type !== "ALL") params.append("type", type);
        params.append("page", String(page));
        params.append("limit", "10");
        if (start) params.append("startDate", start);
        if (end) params.append("endDate", end);

        const response = await api.get(`/transactions/history?${params.toString()}`);
        const data = response.data;

        setTransactions(data.transactions || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
      }
    },
    [historyType, historyPage, startDate, endDate]
  );

  // Initial dashboard load
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (historyType && historyType !== "ALL") params.append("type", historyType);
      params.append("page", "1");
      params.append("limit", "10");
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const [profileResponse, accountResponse, historyResponse] =
        await Promise.all([
          api.get("/users/profile"),
          api.get("/accounts/me"),
          api.get(`/transactions/history?${params.toString()}`),
        ]);

      const profileData = profileResponse.data;
      const accountData = accountResponse.data;
      const historyData = historyResponse.data;

      const loadedUser = profileData.user || profileData.profile || profileData;
      setUser(loadedUser);
      setProfileForm({
        firstName: loadedUser.firstName || "",
        lastName: loadedUser.lastName || "",
        email: loadedUser.email || "",
      });

      setAccount(accountData.account || accountData);
      setTransactions(historyData.transactions || []);
      if (historyData.pagination) {
        setPagination(historyData.pagination);
      }
      setHistoryPage(1);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        onLogout();
        return;
      }

      setError(
        err.response?.data?.message ||
        "Could not load your account details. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [onLogout, historyType, startDate, endDate]);

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const [profileResponse, accountResponse, historyResponse] =
          await Promise.all([
            api.get("/users/profile"),
            api.get("/accounts/me"),
            api.get("/transactions/history?type=ALL&page=1&limit=10"),
          ]);

        if (ignore) return;

        const profileData = profileResponse.data;
        const accountData = accountResponse.data;
        const historyData = historyResponse.data;

        const loadedUser = profileData.user || profileData.profile || profileData;
        setUser(loadedUser);
        setProfileForm({
          firstName: loadedUser.firstName || "",
          lastName: loadedUser.lastName || "",
          email: loadedUser.email || "",
        });

        setAccount(accountData.account || accountData);
        setTransactions(historyData.transactions || []);
        if (historyData.pagination) {
          setPagination(historyData.pagination);
        }
      } catch (err) {
        if (ignore) return;
        if (err.response?.status === 401 || err.response?.status === 403) {
          onLogout();
          return;
        }

        setError(
          err.response?.data?.message ||
          "Could not load your account details. Please try again."
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      ignore = true;
    };
  }, [onLogout]);

  // Handle filter change
  function handleFilterChange(newType) {
    setHistoryType(newType);
    setHistoryPage(1);
    fetchTransactions(newType, 1, startDate, endDate);
  }

  // Handle page change
  function handlePageChange(newPage) {
    setHistoryPage(newPage);
    fetchTransactions(historyType, newPage, startDate, endDate);
  }

  // Handle date filter apply & reset
  function handleDateFilterApply(event) {
    event.preventDefault();
    setHistoryPage(1);
    fetchTransactions(historyType, 1, startDate, endDate);
  }

  function handleDateFilterReset() {
    setStartDate("");
    setEndDate("");
    setHistoryPage(1);
    fetchTransactions(historyType, 1, "", "");
  }

  const balance =
    account?.balanceRupees ??
    account?.balance ??
    (account?.balancePaise != null ? account.balancePaise / 100 : 0);

  const accountNumber = account?.accountNo || "Not available";

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Customer";

  function getTransactionAmount(transaction) {
    if (transaction.amountRupees != null) {
      return Number(transaction.amountRupees);
    }
    if (transaction.amountPaise != null) {
      return Number(transaction.amountPaise) / 100;
    }
    return Number(transaction.amount) || 0;
  }

  // Handle Deposit / Withdraw / Transfer
  async function handleTransaction(event) {
    event.preventDefault();
    setActionError("");
    setActionSuccess("");

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setActionError("Enter a valid amount greater than zero.");
      return;
    }

    if (Math.round(numericAmount * 100) !== numericAmount * 100) {
      setActionError("Amount cannot have more than two decimal places.");
      return;
    }

    if (transactionType === "transfer") {
      const cleanReceiver = receiverAccountNo.trim();
      if (!cleanReceiver) {
        setActionError("Recipient account number is required.");
        return;
      }
      if (cleanReceiver === accountNumber) {
        setActionError("You cannot transfer money to your own account.");
        return;
      }
    }

    setActionLoading(true);

    try {
      if (transactionType === "transfer") {
        await api.post("/transfers", {
          receiverAccountNo: receiverAccountNo.trim(),
          amount: amount,
          remark: remark.trim(),
        });
        setActionSuccess(`Transfer of ₹${amount} completed successfully.`);
      } else {
        const endpoint =
          transactionType === "deposit"
            ? "/transactions/deposit"
            : "/transactions/withdraw";

        await api.post(endpoint, {
          amount: amount,
          remark: remark.trim(),
        });

        setActionSuccess(
          transactionType === "deposit"
            ? "Deposit completed successfully."
            : "Withdrawal completed successfully."
        );
      }

      // Refresh account balance and transaction history
      const accountResponse = await api.get("/accounts/me");
      const accountData = accountResponse.data;
      setAccount(accountData.account || accountData);

      fetchTransactions(historyType, 1);
      setHistoryPage(1);

      setAmount("");
      setRemark("");
      setReceiverAccountNo("");
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
        "Transaction failed. Please check details and try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Profile Update
  async function handleProfileUpdate(event) {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    try {
      const response = await api.put("/users/profile", {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email.trim(),
      });

      const updatedUser = response.data.user;
      setUser(updatedUser);
      setProfileSuccess("Profile updated successfully.");
    } catch (err) {
      setProfileError(
        err.response?.data?.message || "Failed to update profile."
      );
    } finally {
      setProfileLoading(false);
    }
  }

  // Handle Password Change
  async function handlePasswordChange(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    setPasswordLoading(true);

    try {
      await api.put("/users/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });

      setPasswordSuccess("Password changed successfully.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || "Failed to change password."
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <h2>Ace Bank</h2>
            <span>Personal banking</span>
          </div>
        </div>

        <div className="dashboard-user">
          <div className="user-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>

          <div className="user-details">
            <strong>{displayName}</strong>
            <span>Account holder</span>
          </div>

          <button
            className="settings-button"
            onClick={() => {
              setShowProfileModal(true);
              setProfileError("");
              setProfileSuccess("");
              setPasswordError("");
              setPasswordSuccess("");
            }}
            title="Profile & Settings"
          >
            ⚙ Settings
          </button>

          <button className="logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <div>
            <span className="dashboard-eyebrow">YOUR FINANCIAL OVERVIEW</span>
            <h1>Welcome, {displayName.split(" ")[0]}!</h1>
            <p>Here's what's happening with your account.</p>
          </div>

          <button
            className="refresh-button"
            onClick={() => loadDashboard()}
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="message error dashboard-error">
            {error}
            <button onClick={() => loadDashboard()}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="dashboard-loading">
            Loading your account information...
          </div>
        ) : (
          <>
            <section className="balance-card">
              <div className="balance-card-top">
                <span>Available balance</span>
                <span className="account-status">
                  <span></span>
                  {account?.status || "ACTIVE"}
                </span>
              </div>

              <h2>{formatINR(balance)}</h2>

              <div className="account-number">
                <span>ACCOUNT NUMBER</span>
                <strong>{accountNumber}</strong>
              </div>

              <div className="balance-card-bottom">
                <span>
                  {account?.accountType || "SAVINGS"} ACCOUNT
                </span>
                <span>Ace Bank</span>
              </div>
            </section>

            <section className="money-action-panel">
              <div className="money-action-heading">
                <h2>Manage your money</h2>
                <p>Deposit funds, withdraw cash, or transfer to another account.</p>
              </div>

              <div className="money-action-tabs three-tabs">
                <button
                  type="button"
                  className={
                    transactionType === "deposit"
                      ? "money-tab active"
                      : "money-tab"
                  }
                  onClick={() => {
                    setTransactionType("deposit");
                    setActionError("");
                    setActionSuccess("");
                  }}
                >
                  ↓ Deposit
                </button>

                <button
                  type="button"
                  className={
                    transactionType === "withdraw"
                      ? "money-tab active"
                      : "money-tab"
                  }
                  onClick={() => {
                    setTransactionType("withdraw");
                    setActionError("");
                    setActionSuccess("");
                  }}
                >
                  ↑ Withdraw
                </button>

                <button
                  type="button"
                  className={
                    transactionType === "transfer"
                      ? "money-tab active"
                      : "money-tab"
                  }
                  onClick={() => {
                    setTransactionType("transfer");
                    setActionError("");
                    setActionSuccess("");
                  }}
                >
                  → Transfer
                </button>
              </div>

              <form className="money-action-form" onSubmit={handleTransaction}>
                {transactionType === "transfer" && (
                  <div className="form-field">
                    <label htmlFor="receiverAccountNo">Recipient Account Number</label>
                    <input
                      id="receiverAccountNo"
                      type="text"
                      pattern="[0-9]{10}"
                      maxLength={10}
                      value={receiverAccountNo}
                      onChange={(event) => setReceiverAccountNo(event.target.value)}
                      placeholder="10-digit account number"
                      required
                    />
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="transactionAmount">Amount (₹)</label>
                  <input
                    id="transactionAmount"
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Enter amount in ₹"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="transactionRemark">Remark (optional)</label>
                  <input
                    id="transactionRemark"
                    type="text"
                    maxLength={255}
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    placeholder={
                      transactionType === "transfer"
                        ? "e.g. Rent, Books, Personal"
                        : "e.g. Monthly savings"
                    }
                  />
                </div>

                {transactionType === "withdraw" && (
                  <p className="withdrawal-note">
                    Your account has a ₹500 daily withdrawal limit, enforced by
                    the backend.
                  </p>
                )}

                {transactionType === "transfer" && (
                  <p className="withdrawal-note">
                    Transfers debit your account and credit the recipient account
                    atomically in real time.
                  </p>
                )}

                {actionError && (
                  <div className="message error">{actionError}</div>
                )}

                {actionSuccess && (
                  <div className="message success">{actionSuccess}</div>
                )}

                <button
                  className="submit-button money-submit"
                  type="submit"
                  disabled={actionLoading || loading}
                >
                  {actionLoading
                    ? "Processing..."
                    : transactionType === "deposit"
                      ? "Deposit money"
                      : transactionType === "withdraw"
                        ? "Withdraw money"
                        : "Transfer money"}
                </button>
              </form>
            </section>

            <section className="dashboard-stats">
              <article className="stat-card">
                <div className="stat-icon">₹</div>
                <div>
                  <span>Current balance</span>
                  <strong>{formatINR(balance)}</strong>
                </div>
              </article>

              <article className="stat-card">
                <div className="stat-icon">↔</div>
                <div>
                  <span>Total transactions</span>
                  <strong>{pagination.totalRecords}</strong>
                </div>
              </article>

              <article className="stat-card">
                <div className="stat-icon">✓</div>
                <div>
                  <span>Account status</span>
                  <strong>{account?.status || "ACTIVE"}</strong>
                </div>
              </article>
            </section>

            <section className="transaction-panel">
              <div className="transaction-heading">
                <div>
                  <h2>Recent transactions</h2>
                  <p>Your latest account activity</p>
                </div>

                {/* Filter chips */}
                <div className="tx-filter-chips">
                  {["ALL", "DEPOSIT", "WITHDRAWAL", "TRANSFER"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={
                        historyType === type
                          ? "tx-chip active"
                          : "tx-chip"
                      }
                      onClick={() => handleFilterChange(type)}
                    >
                      {type === "ALL" ? "All" : type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="empty-transactions">
                  <div className="empty-icon">↔</div>
                  <h3>No transactions found</h3>
                  <p>
                    {historyType === "ALL"
                      ? "Your deposits, withdrawals, and transfers will appear here."
                      : `No ${historyType.toLowerCase()} transactions recorded yet.`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="transaction-list">
                    {transactions.map((transaction, index) => {
                      const type =
                        transaction.txType ||
                        transaction.type ||
                        "TRANSACTION";

                      const isCredit =
                        String(transaction.direction || "").toUpperCase() === "CREDIT";

                      return (
                        <article
                          className="transaction-row"
                          key={transaction._id || transaction.id || index}
                        >
                          <div
                            className={
                              isCredit
                                ? "transaction-icon credit"
                                : "transaction-icon debit"
                            }
                          >
                            {isCredit ? "↓" : "↑"}
                          </div>

                          <div className="transaction-info">
                            <strong>
                              {type.charAt(0) + type.slice(1).toLowerCase()}
                              {type === "TRANSFER" && (
                                <span className="account-tag">
                                  {isCredit
                                    ? ` from ${transaction.senderAccount?.accountNo || "account"}`
                                    : ` to ${transaction.receiverAccount?.accountNo || "account"}`}
                                </span>
                              )}
                            </strong>
                            <span>
                              {transaction.remark || "Bank transaction"}
                            </span>
                            <small>
                              {transaction.createdAt
                                ? new Date(transaction.createdAt).toLocaleString(
                                    "en-IN",
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    }
                                  )
                                : "Date unavailable"}
                            </small>
                          </div>

                          <strong
                            className={
                              isCredit ? "amount-credit" : "amount-debit"
                            }
                          >
                            {isCredit ? "+" : "−"}
                            {formatINR(getTransactionAmount(transaction))}
                          </strong>
                        </article>
                      );
                    })}
                  </div>

                  {/* Pagination Navigation */}
                  {pagination.totalPages > 1 && (
                    <div className="pagination-bar">
                      <button
                        type="button"
                        className="page-button"
                        disabled={!pagination.hasPrevPage}
                        onClick={() => handlePageChange(historyPage - 1)}
                      >
                        ← Previous
                      </button>

                      <span className="page-info">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>

                      <button
                        type="button"
                        className="page-button"
                        disabled={!pagination.hasNextPage}
                        onClick={() => handlePageChange(historyPage + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        )}

        <footer className="dashboard-footer">
          Ace Bank MERN learning project · Use dummy data only
        </footer>
      </main>

      {/* Settings & Profile Modal */}
      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Profile & Settings</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowProfileModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-tabs">
              <button
                type="button"
                className={settingsTab === "profile" ? "modal-tab active" : "modal-tab"}
                onClick={() => setSettingsTab("profile")}
              >
                Personal Details
              </button>
              <button
                type="button"
                className={settingsTab === "password" ? "modal-tab active" : "modal-tab"}
                onClick={() => setSettingsTab("password")}
              >
                Security & Password
              </button>
            </div>

            <div className="modal-body">
              {settingsTab === "profile" ? (
                <form onSubmit={handleProfileUpdate}>
                  <div className="read-only-info">
                    <div>
                      <span>Account Number:</span>
                      <strong>{accountNumber}</strong>
                    </div>
                    <div>
                      <span>Account Status:</span>
                      <strong className="status-badge">{account?.status || "ACTIVE"}</strong>
                    </div>
                  </div>

                  <div className="name-fields">
                    <div className="form-field">
                      <label htmlFor="profileFirstName">First Name</label>
                      <input
                        id="profileFirstName"
                        value={profileForm.firstName}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, firstName: e.target.value })
                        }
                        maxLength={50}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="profileLastName">Last Name</label>
                      <input
                        id="profileLastName"
                        value={profileForm.lastName}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, lastName: e.target.value })
                        }
                        maxLength={50}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="profileEmail">Email Address</label>
                    <input
                      id="profileEmail"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  {profileError && <div className="message error">{profileError}</div>}
                  {profileSuccess && <div className="message success">{profileSuccess}</div>}

                  <button
                    type="submit"
                    className="submit-button modal-submit"
                    disabled={profileLoading}
                  >
                    {profileLoading ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordChange}>
                  <div className="form-field">
                    <label htmlFor="currentPassword">Current Password</label>
                    <input
                      id="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value,
                        })
                      }
                      placeholder="Enter current password"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="newPassword">New Password</label>
                    <input
                      id="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value,
                        })
                      }
                      placeholder="At least 8 characters"
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Re-enter new password"
                      required
                    />
                  </div>

                  {passwordError && <div className="message error">{passwordError}</div>}
                  {passwordSuccess && <div className="message success">{passwordSuccess}</div>}

                  <button
                    type="submit"
                    className="submit-button modal-submit"
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;