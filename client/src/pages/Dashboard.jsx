
import { useEffect, useState } from "react";
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
    const [transactionType, setTransactionType] = useState("deposit");
    const [amount, setAmount] = useState("");
    const [remark, setRemark] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState("");
    const [actionSuccess, setActionSuccess] = useState("");

    useEffect(() => {
        async function loadDashboard() {
            setLoading(true);
            setError("");

            try {
                const [profileResponse, accountResponse, historyResponse] =
                    await Promise.all([
                        api.get("/users/profile"),
                        api.get("/accounts/me"),
                        api.get("/transactions/history"),
                    ]);

                const profileData = profileResponse.data;
                const accountData = accountResponse.data;
                const historyData = historyResponse.data;

                setUser(
                    profileData.user ||
                    profileData.profile ||
                    profileData
                );

                setAccount(
                    accountData.account ||
                    accountData
                );

                setTransactions(
                    historyData.transactions ||
                    historyData.history ||
                    []
                );
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
        }

        loadDashboard();
    }, [onLogout]);

    const balance =
        account?.balanceRupees ??
        account?.balance ??
        (account?.balancePaise != null ? account.balancePaise / 100 : 0);

    const accountNumber =
        account?.accountNo || "Not available";

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

  setActionLoading(true);

  try {
    const endpoint =
      transactionType === "deposit"
        ? "/transactions/deposit"
        : "/transactions/withdraw";

    await api.post(endpoint, {
      amount: amount,
      remark: remark.trim(),
    });

    // Refresh the account balance and transaction history.
    const [accountResponse, historyResponse] = await Promise.all([
      api.get("/accounts/me"),
      api.get("/transactions/history"),
    ]);

    const accountData = accountResponse.data;
    const historyData = historyResponse.data;

    setAccount(accountData.account || accountData);

    setTransactions(
      historyData.transactions || historyData.history || []
    );

    setActionSuccess(
      transactionType === "deposit"
        ? "Deposit completed successfully."
        : "Withdrawal completed successfully."
    );

    setAmount("");
    setRemark("");
  } catch (err) {
    setActionError(
      err.response?.data?.message ||
        "Transaction failed. Please try again."
    );
  } finally {
    setActionLoading(false);
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
                        onClick={() => window.location.reload()}
                    >
                        ↻ Refresh
                    </button>
                </div>

                {error && (
                    <div className="message error dashboard-error">
                        {error}
                        <button onClick={() => window.location.reload()}>
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
                                    {account?.status || "Account"}
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
    <p>Deposit funds or withdraw from your account.</p>
  </div>

  <div className="money-action-tabs">
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
  </div>

  <form className="money-action-form" onSubmit={handleTransaction}>
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
        placeholder="Enter amount"
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
        placeholder="e.g. Monthly savings"
      />
    </div>

    {transactionType === "withdraw" && (
      <p className="withdrawal-note">
        Your account has a ₹500 daily withdrawal limit, enforced by
        the backend.
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
          : "Withdraw money"}
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
                                    <span>Transactions loaded</span>
                                    <strong>{transactions.length}</strong>
                                </div>
                            </article>

                            <article className="stat-card">
                                <div className="stat-icon">✓</div>
                                <div>
                                    <span>Account status</span>
                                    <strong>{account?.status || "Unknown"}</strong>
                                </div>
                            </article>
                        </section>

                        <section className="transaction-panel">
                            <div className="transaction-heading">
                                <div>
                                    <h2>Recent transactions</h2>
                                    <p>Your latest account activity</p>
                                </div>
                                <span className="transaction-count">
                                    {transactions.length} records
                                </span>
                            </div>

                            {transactions.length === 0 ? (
                                <div className="empty-transactions">
                                    <div className="empty-icon">↔</div>
                                    <h3>No transactions yet</h3>
                                    <p>
                                        Your deposits, withdrawals, and transfers will appear here.
                                    </p>
                                </div>
                            ) : (
                                <div className="transaction-list">
                                    {transactions.map((transaction, index) => {
                                        const type =
                                            transaction.txType ||
                                            transaction.type ||
                                            "TRANSACTION";

                                        const direction =
                                            String(transaction.direction || "").toUpperCase();

                                        const isCredit =
                                            direction === "CREDIT" ||
                                            direction === "INCOMING" ||
                                            type === "DEPOSIT" ||
                                            transaction.receiverAccount != null;

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
                            )}
                        </section>
                    </>
                )}

                <footer className="dashboard-footer">
                    Ace Bank MERN learning project · Use dummy data only
                </footer>
            </main>
        </div>
    );
}

export default Dashboard;