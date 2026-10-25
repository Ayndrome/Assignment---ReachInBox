import "dotenv/config";
import { NodemailerEmailSender } from "../../../shared/src/email/nodemailer_email_sender";
import { requiredEnv } from "../../../shared/src/utils/require";

async function main(): Promise<void> {
  const port = Number(requiredEnv("SMTP_PORT"));

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer");
  }

  const emailSender = new NodemailerEmailSender({
    host: requiredEnv("SMTP_HOST"),
    port,
    secure: process.env.SMTP_SECURE === "true",
    
  });

  await emailSender.verifyConnection();

  const result = await emailSender.send({
    from: requiredEnv("SMTP_FROM"),
    to: requiredEnv("SMTP_USER"),
    subject: "ReachInbox SMTP smoke test",
    text: "The email delivery infrastructure is working.",
    html: "<p>The email delivery infrastructure is working.</p>",
  });

  console.log("Email accepted by SMTP server.");
  console.log("Message ID:", result.messageId);
  console.log("Preview URL:", result.previewURL);
}

main().catch((error: unknown) => {
  console.error("SMTP smoke test failed:", error);
  process.exitCode = 1;
});
