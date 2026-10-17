const CURRENT_YEAR = new Date().getFullYear();

export default function LandingPage({
  onNavigateLogin,
  onNavigateRegister,
  darkMode,
  toggleDarkMode,
}) {
  return (
    <div className={`landing-page ${darkMode ? "dark-mode" : ""}`}>
      {/* Navigation Topbar */}
      <header className="landing-nav">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <h2>Ace Bank</h2>
            <span>Digital Banking Portal</span>
          </div>
        </div>

        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#loans">Loans</a>
          <a href="#security">Security</a>
        </nav>

        <div className="landing-nav-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={onNavigateLogin}
          >
            Sign In
          </button>

          <button
            type="button"
            className="submit-button cta-nav-btn"
            onClick={onNavigateRegister}
          >
            Open Account
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <span className="eyebrow">NEXT-GENERATION BANKING</span>
          <h1>
            Intelligent banking built for <span>modern living.</span>
          </h1>
          <p>
            Experience frictionless personal banking with real-time balances, atomic transfers,
            certified downloadable statements, and seamless loan applications.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              className="submit-button hero-primary-cta"
              onClick={onNavigateRegister}
            >
              Get Started in Minutes &rarr;
            </button>
            <button
              type="button"
              className="secondary-btn hero-secondary-cta"
              onClick={onNavigateLogin}
            >
              Sign In to Your Account
            </button>
          </div>

          <div className="hero-trust-row">
            <div className="trust-badge">
              <span className="trust-dot"></span>
              15-Minute Session Inactivity Protection
            </div>
            <div className="trust-badge">
              <span className="trust-dot"></span>
              Atomic MongoDB Multi-Document Transactions
            </div>
            <div className="trust-badge">
              <span className="trust-dot"></span>
              Automated Email Verification & Recovery
            </div>
          </div>
        </div>

        {/* Hero Visual Card Preview */}
        <div className="hero-card-preview">
          <div className="preview-debit-card">
            <div className="card-chip"></div>
            <div className="card-brand">ACE BANK</div>
            <div className="card-number-display">•••• •••• •••• 9842</div>
            <div className="card-footer-info">
              <div>
                <span>ACCOUNT HOLDER</span>
                <strong>VALUED CUSTOMER</strong>
              </div>
              <div>
                <span>STATUS</span>
                <strong className="card-status-active">ACTIVE</strong>
              </div>
            </div>
          </div>

          <div className="hero-floating-stat">
            <span className="stat-label">INSTANT TRANSFERS</span>
            <strong>₹0.00 Hidden Fees</strong>
            <small>Direct ledger settlement</small>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="eyebrow">DESIGNED FOR SPEED & INTEGRITY</span>
          <h2>Everything you need from your bank</h2>
          <p>Carefully engineered features to manage your money with complete confidence.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-card-icon">⚡</div>
            <h3>Atomic Fund Transfers</h3>
            <p>
              Send funds in real time to any ACE Bank account with dual-ledger verification and MongoDB
              replica set transaction safety.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card-icon">💰</div>
            <h3>Deposits & Cash Withdrawals</h3>
            <p>
              Simulate deposits and monitor strict daily withdrawal limits to maintain strict financial
              discipline.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card-icon">📊</div>
            <h3>Downloadable Statements</h3>
            <p>
              Export custom date-range account statements in CSV format with opening balance calculations
              and formula injection defenses.
            </p>
          </div>

          <div className="feature-card" id="loans">
            <div className="feature-card-icon">🏠</div>
            <h3>Home & Personal Loans</h3>
            <p>
              Apply directly online for Personal Loans up to ₹25 Lakhs and Home Loans up to ₹10 Crores
              with instant confirmation emails.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card-icon">🛡️</div>
            <h3>Account & Password Recovery</h3>
            <p>
              Retrieve forgotten account numbers safely through verified email delivery, and reset passwords
              via time-limited cryptographically secure tokens.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-card-icon">🌗</div>
            <h3>Dynamic Dark & Light Modes</h3>
            <p>
              Enjoy a tailored visual experience with native system theme detection and manual light/dark
              toggling across all banking views.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-header">
          <span className="eyebrow">SIMPLE 4-STEP PROCESS</span>
          <h2>How ACE Banking Works</h2>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Register Instantly</h3>
            <p>Sign up with immediate live field validation, Aadhaar format check, and encrypted credentials.</p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Receive Account Number</h3>
            <p>Your unique 10-digit savings account is provisioned immediately with a welcome email confirmation.</p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Transact with Safety</h3>
            <p>Deposit simulated funds, execute instant transfers, and track categorized transaction history.</p>
          </div>

          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Financing & Statements</h3>
            <p>Apply for credit products, view application statuses, and export official statement records anytime.</p>
          </div>
        </div>
      </section>

      {/* Security & Architecture Section */}
      <section id="security" className="security-section">
        <div className="security-box">
          <div className="security-badge">🔒 SECURE BY DESIGN</div>
          <h2>Bank-Grade Security Architecture</h2>
          <p>
            ACE Banking System implements layered controls: integer paise representation eliminates rounding
            errors, 15-minute access JWT expiration mitigates unauthorized session reuse, and rate-limiting
            protects sensitive recovery workflows.
          </p>

          <div className="security-points-grid">
            <div className="security-point">
              <strong>✓ Inactivity Guard</strong>
              <span>Automatic warning modal at 14 minutes and logout at 15 minutes of inactivity.</span>
            </div>
            <div className="security-point">
              <strong>✓ Token Revocation</strong>
              <span>Tokens issued before password modifications are rejected instantly on the backend.</span>
            </div>
            <div className="security-point">
              <strong>✓ Formula Injection Shield</strong>
              <span>CSV downloads sanitize spreadsheet formula triggers (=, +, -, @) automatically.</span>
            </div>
            <div className="security-point">
              <strong>✓ Strict User Isolation</strong>
              <span>Users can only view their own accounts, loan applications, and transactions.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="brand">
              <div className="brand-icon">A</div>
              <div>
                <h2>Ace Bank</h2>
                <span>Banking made simple</span>
              </div>
            </div>
            <p>A comprehensive full-stack MERN banking application engineered for high-integrity workflows.</p>
          </div>

          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><button type="button" onClick={onNavigateLogin}>Online Banking Login</button></li>
              <li><button type="button" onClick={onNavigateRegister}>Open an Account</button></li>
              <li><a href="#features">Key Features</a></li>
              <li><a href="#loans">Loan Products</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Support & Recovery</h4>
            <ul>
              <li><button type="button" onClick={onNavigateLogin}>Forgot Account Number</button></li>
              <li><button type="button" onClick={onNavigateLogin}>Reset Password</button></li>
              <li><a href="#security">Security Information</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Notice</h4>
            <p className="footer-disclaimer">
              This application is an educational simulation. Do not submit actual personal financial numbers
              or real government credentials.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {CURRENT_YEAR} ACE Banking System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
