import nodemailer from "nodemailer";

let transporterPromise = null;

/**
 * Creates or retrieves a cached Nodemailer transporter.
 * Supports production SMTP via environment variables (SMTP_* or EMAIL_*)
 * and automatically falls back to an Ethereal test account for development/testing.
 */
export async function getTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    // 1. Check for real SMTP configuration
    const host = process.env.SMTP_HOST || (process.env.EMAIL_USER && process.env.EMAIL_USER.includes("gmail") ? "smtp.gmail.com" : null);
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD;

    if (host && user && pass) {
      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    }

    // 2. Fall back to Ethereal for development & testing
    try {
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.warn("Could not create Ethereal test account, using stub transport:", err.message);
      // Stub fallback if completely offline during unit tests
      return {
        sendMail: async (options) => ({
          messageId: "stub-" + Date.now(),
          response: "250 Stub OK",
          envelope: { to: [options.to] },
        }),
      };
    }
  })();

  return transporterPromise;
}

/**
 * Reset transporter cache (useful for testing configuration changes)
 */
export function resetTransporter() {
  transporterPromise = null;
}

/**
 * Base email layout wrapping HTML content with ACE Banking System visual identity
 */
function renderBaseTemplate({ title, heading, bodyContent, securityNote }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f7fc;
      color: #17233b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f7fc;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #214fcb 0%, #17389c 100%);
      padding: 32px 36px;
      text-align: center;
      color: #ffffff;
    }
    .logo-badge {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.2);
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 6px 0 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
    }
    .content {
      padding: 36px;
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .content h2 {
      margin: 0 0 16px;
      font-size: 19px;
      color: #0f172a;
    }
    .content p {
      margin: 0 0 16px;
    }
    .card-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .btn {
      display: inline-block;
      padding: 13px 28px;
      background-color: #214fcb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .security-notice {
      margin-top: 24px;
      padding: 14px 18px;
      background-color: #fefce8;
      border-left: 4px solid #eab308;
      border-radius: 4px;
      font-size: 13px;
      color: #713f12;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 36px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">A</div>
        <h1>ACE Banking System</h1>
        <p>Secure & Modern Digital Banking</p>
      </div>
      <div class="content">
        <h2>${heading}</h2>
        ${bodyContent}
        ${securityNote ? `<div class="security-notice"><strong>Security Notice:</strong> ${securityNote}</div>` : ""}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ACE Banking System. All rights reserved.</p>
        <p>This is an automated banking notification. Please do not reply directly to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Low-level email dispatch with error handling and sanitized logging.
 */
export async function sendEmail({ to, subject, text, html }) {
  try {
    const transporter = await getTransporter();
    const fromAddress = process.env.EMAIL_FROM || '"ACE Banking System" <noreply@acebank.com>';

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
    });

    if (nodemailer.getTestMessageUrl && info) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log("Email preview available:", previewUrl);
      }
    }

    return info;
  } catch (error) {
    // Sanitized logging: log failure without exposing tokens, passwords or account numbers
    console.error("Email delivery failed for recipient domain:", to ? to.split("@")[1] : "unknown", "-", error.message);
    throw error;
  }
}

/**
 * 1. Welcome Email after successful registration
 */
export async function sendWelcomeEmail({ to, firstName }) {
  const safeName = firstName || "Valued Customer";
  const subject = "Welcome to ACE Banking System";
  const text = `Hello ${safeName},\n\nWelcome to ACE Banking System! Your registration was successful and your active savings account has been created.\n\nYou can now log in to view your dashboard, deposit funds, transfer money, and explore loan offerings.\n\nThank you for choosing ACE Banking System.\n\nBest regards,\nACE Banking System Team`;

  const bodyContent = `
    <p>Hello <strong>${safeName}</strong>,</p>
    <p>Welcome to <strong>ACE Banking System</strong>! Your registration was successful and your personal savings account is now active.</p>
    <div class="card-box">
      <p style="margin: 0; font-size: 14px; color: #475569;">You now have instant access to:</p>
      <ul style="margin: 10px 0 0; padding-left: 20px; color: #334155; font-size: 14px;">
        <li>Real-time balances and transaction history</li>
        <li>Instant atomic fund transfers to other accounts</li>
        <li>Downloadable monthly and custom account statements</li>
        <li>Home Loan and Personal Loan applications</li>
      </ul>
    </div>
    <p>Log in anytime through our secure portal to manage your funds.</p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html: renderBaseTemplate({
      title: subject,
      heading: `Welcome, ${safeName}!`,
      bodyContent,
      securityNote: "ACE Banking System will never ask for your password or OTP over phone or email.",
    }),
  });
}

/**
 * 2. Account Number Recovery Email
 */
export async function sendAccountRecoveryEmail({ to, firstName, accountNo }) {
  const safeName = firstName || "Valued Customer";
  const subject = "Your ACE Bank Account Number Recovery";
  const text = `Hello ${safeName},\n\nYou requested the recovery of your ACE Banking System account number.\n\nYour Bank Account Number is: ${accountNo}\n\nYou can use this account number along with your registered credentials to access your banking services.\n\nIf you did not request this recovery, please review your account security immediately.\n\nBest regards,\nACE Banking System Team`;

  const bodyContent = `
    <p>Hello <strong>${safeName}</strong>,</p>
    <p>We received a request to retrieve your bank account number associated with this registered email address.</p>
    <div class="card-box" style="text-align: center; background-color: #eff6ff; border-color: #bfdbfe;">
      <span style="display: block; font-size: 12px; letter-spacing: 1px; color: #1e40af; font-weight: 700;">YOUR ACCOUNT NUMBER</span>
      <span style="display: block; font-size: 26px; font-weight: 800; color: #1d4ed8; letter-spacing: 3px; margin-top: 6px;">${accountNo}</span>
    </div>
    <p>You can use this account number to receive transfers or reference your banking transactions.</p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html: renderBaseTemplate({
      title: subject,
      heading: "Account Number Recovery",
      bodyContent,
      securityNote: "If you did not request your account number, please contact our support team immediately.",
    }),
  });
}

/**
 * 3. Password Reset Email
 */
export async function sendPasswordResetEmail({ to, firstName, resetLink }) {
  const safeName = firstName || "Customer";
  const subject = "Reset your ACE Banking System password";
  const text = `Hello ${safeName},\n\nWe received a request to reset your ACE Banking System password.\n\nPlease use the following link to choose a new password:\n${resetLink}\n\nThis link will expire in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nBest regards,\nACE Banking System Team`;

  const bodyContent = `
    <p>Hello <strong>${safeName}</strong>,</p>
    <p>We received a request to reset the password for your ACE Banking System account.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetLink}" class="btn">Reset My Password &rarr;</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Or paste this link into your browser: <br><span style="word-break: break-all; color: #2563eb;">${resetLink}</span></p>
    <p style="font-size: 13px; color: #64748b;">This password reset link is valid for <strong>15 minutes</strong> only.</p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html: renderBaseTemplate({
      title: subject,
      heading: "Password Reset Request",
      bodyContent,
      securityNote: "If you did not request this reset, your account is still secure. No changes have been made.",
    }),
  });
}

/**
 * 4. Loan Application Confirmation Email
 */
export async function sendLoanConfirmationEmail({
  to,
  firstName,
  applicationRef,
  loanType,
  amountRupees,
  tenureMonths,
}) {
  const safeName = firstName || "Valued Customer";
  const formattedLoanType = loanType === "HOME_LOAN" ? "Home Loan" : "Personal Loan";
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amountRupees) || 0);

  const subject = `Loan Application Received — Ref #${applicationRef}`;
  const text = `Hello ${safeName},\n\nYour application for an ACE Bank ${formattedLoanType} has been successfully received.\n\nApplication Details:\n- Reference ID: ${applicationRef}\n- Loan Type: ${formattedLoanType}\n- Requested Amount: ${formattedAmount}\n- Tenure: ${tenureMonths} Months\n- Status: PENDING UNDERWRITING REVIEW\n\nPlease note: This confirmation acknowledges receipt of your application. Loan approval is subject to verification and underwriting guidelines.\n\nYou can track the status of your application from your online dashboard.\n\nBest regards,\nACE Banking System Loans Division`;

  const bodyContent = `
    <p>Hello <strong>${safeName}</strong>,</p>
    <p>Thank you for choosing ACE Banking System for your financing needs. We have successfully received your loan application.</p>
    <div class="card-box">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Reference ID:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: right;">${applicationRef}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Loan Type:</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a; text-align: right;">${formattedLoanType}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Requested Amount:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #1d4ed8; text-align: right;">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Tenure:</td>
          <td style="padding: 6px 0; color: #0f172a; text-align: right;">${tenureMonths} Months</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Initial Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #d97706; text-align: right;">PENDING REVIEW</td>
        </tr>
      </table>
    </div>
    <p style="font-size: 13px; color: #64748b;">
      <em>Important Notice:</em> Submission of a loan application does not constitute loan approval. Our underwriting team will review your application according to established credit policies.
    </p>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html: renderBaseTemplate({
      title: subject,
      heading: "Loan Application Received",
      bodyContent,
      securityNote: "Bank representatives will never ask you to pay an advance fee or share account passwords to process your loan.",
    }),
  });
}