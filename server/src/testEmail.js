import nodemailer from "nodemailer";

async function testEmail() {
  try {
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"ACE Banking System" <ace-bank@example.com>',
      to: "test@example.com",
      subject: "ACE Banking System - Email Test",
      text: "Your email service test is working.",
      html: "<h2>Email test successful!</h2><p>Your ACE Banking System can generate emails.</p>",
    });

    console.log("Test email sent successfully!");
    console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error("Email test failed:", error.message);
  }
}

testEmail();