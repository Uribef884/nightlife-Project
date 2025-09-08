import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

import { generateTicketEmailHTML } from "../templates/ticketEmailTemplate";
import { generateMenuEmailHTML } from "../templates/menuEmailTemplate";
import { generateUnifiedTicketEmailHTML } from "../templates/unifiedTicketEmailTemplate";
import { generatePasswordResetEmailHTML } from "../templates/passwordResetEmailTemplate";
import { generateTransactionInvoiceHTML } from "../templates/transactionInvoiceTemplate";

/* =========================================================
   Types (unchanged)
   ========================================================= */
type TicketEmailPayload = {
  to: string;
  ticketName: string;
  date: string;
  qrImageDataUrl: string;
  clubName: string;
  index?: number;
  total?: number;
};

type MenuEmailPayload = {
  to: string;
  qrImageDataUrl: string;
  clubName: string;
  items: Array<{
    name: string;
    variant: string | null;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
};

type MenuFromTicketEmailPayload = {
  to: string;
  email: string;
  ticketName: string;
  date: string;
  qrImageDataUrl: string;
  clubName: string;
  items: Array<{
    name: string;
    variant: string | null;
    quantity: number;
  }>;
  index?: number;
  total?: number;
};

type UnifiedTicketEmailPayload = {
  to: string;
  email: string;
  ticketName: string;
  date: string;
  ticketQrImageDataUrl: string;
  menuQrImageDataUrl: string;
  clubName: string;
  menuItems: Array<{
    name: string;
    variant: string | null;
    quantity: number;
  }>;
  index?: number;
  total?: number;
  description?: string | null;
  purchaseId?: string;
};

/* =========================================================
   Centralized SMTP config + guards
   ========================================================= */
const ENV = (process.env.NODE_ENV || "development").toLowerCase();

const SMTP_HOST = process.env.SMTP_HOST || "smtp.mailgun.org";
const SMTP_PORT = Number(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

if (!SMTP_USER || !SMTP_PASS) {
  throw new Error("[EMAIL] Missing SMTP_USER/SMTP_PASS in environment.");
}

// derive domain (everything after @). We will re-use this for From:
const smtpDomain = (SMTP_USER.split("@")[1] || "").toLowerCase();

// detect Mailgun sandbox users (anything@<sandbox...>.mailgun.org)
const isSandbox = /\.?sandbox[0-9a-f\-]*\.mailgun\.org$/i.test(smtpDomain);

// In prod: hard block sandbox. In dev: warn but continue.
if (isSandbox && ENV === "production") {
  throw new Error(
    `[EMAIL] SMTP user belongs to a Mailgun SANDBOX domain (${smtpDomain}). ` +
      `Use verified production SMTP_* credentials.`
  );
}
if (isSandbox && ENV !== "production") {
  console.warn(
    `[EMAIL] Using Mailgun SANDBOX domain (${smtpDomain}) in ${ENV}. ` +
      `Only authorized recipients will receive emails.`
  );
}

// Optional dev redirect: route ALL outgoing mail to a safe inbox when sandbox or when you want to force it.
// Example in .env: MAIL_FORCE_TO=felipeu2009@outlook.com
const MAIL_FORCE_TO = (process.env.MAIL_FORCE_TO || "").trim();

// build a DMARC-safe From using the same domain as SMTP_USER
function buildFrom(label: string) {
  const local = process.env.MAIL_FROM_LOCAL || "no-reply";
  return `"${label}" <${local}@${smtpDomain}>`;
}

// Single transporter for the whole app
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // implicit TLS only for 465; use STARTTLS on 587
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Log once so you can see which creds are live at runtime
void transporter.verify().then(() => {
  console.log('[EMAIL] SMTP connection verified successfully');
}).catch((error) => {
  console.error('[EMAIL] SMTP connection failed:', error);
});

/* =========================================================
   Helpers: inline logo + recipient resolver
   ========================================================= */

// Inline logo attachment — MUST match src="cid:nl-logo.png" in templates
function getInlineLogoAttachment() {
  const logoPath = path.resolve(process.cwd(), "assets/email/nl-logo.png");
  if (!fs.existsSync(logoPath)) {
    throw new Error(`[EMAIL] Logo missing at ${logoPath}. Add assets/email/nl-logo.png`);
  }
  return {
    filename: "nl-logo.png",
    path: logoPath,
    contentType: "image/png",
    cid: "nl-logo.png",
  };
}

// Resolve "to" for dev when using sandbox or when you deliberately want to redirect all mail.
function resolveTo(to: string): { to: string; headers?: Record<string, string> } {
  // In dev or any env where MAIL_FORCE_TO is set, allow redirect.
  if (MAIL_FORCE_TO) {
    // If you're on sandbox, redirect to a single authorized inbox to avoid 421.
    if (isSandbox || ENV !== "production") {
      return {
        to: MAIL_FORCE_TO,
        headers: { "X-Original-To": to } // Helps you know who it was intended for
      };
    }
  }
  // Default: send to the intended recipient
  return { to };
}

/* =========================================================
   Senders (unified behavior)
   ========================================================= */

// 1) Ticket: one email per ticket (one QR each)
export async function sendTicketEmail(payload: TicketEmailPayload) {
  console.log(`[EMAIL] Sending ticket email to: ${payload.to}`);
  console.log(`[EMAIL] Ticket: ${payload.ticketName}, Club: ${payload.clubName}`);
  
  const html = generateTicketEmailHTML({ ...payload, email: payload.to });

  const { to, headers } = resolveTo(payload.to);
  console.log(`[EMAIL] Resolved recipient: ${to}`);
  
  try {
    await transporter.sendMail({
      from: buildFrom("NightLife Tickets"),
      to,
      subject: `🎟️ Tu entrada: ${payload.ticketName}`,
      html,
      attachments: [getInlineLogoAttachment()],
      headers,
    });
    console.log(`[EMAIL] ✅ Ticket email sent successfully to: ${to}`);
  } catch (error) {
    console.error(`[EMAIL] ❌ Failed to send ticket email to ${to}:`, error);
    throw error;
  }
}

// 2) Menu: one email per transaction (one QR)
export async function sendMenuEmail(payload: MenuEmailPayload) {
  console.log(`[EMAIL] Sending menu email to: ${payload.to}`);
  console.log(`[EMAIL] Club: ${payload.clubName}, Items: ${payload.items.length}`);
  
  const html = generateMenuEmailHTML(payload);

  const { to, headers } = resolveTo(payload.to);
  console.log(`[EMAIL] Resolved recipient: ${to}`);
  
  try {
    await transporter.sendMail({
      from: buildFrom("NightLife Menú"),
      to,
      subject: `🍹 Tu QR de menú - ${payload.clubName}`,
      html,
      attachments: [getInlineLogoAttachment()],
      headers,
    });
    console.log(`[EMAIL] ✅ Menu email sent successfully to: ${to}`);
  } catch (error) {
    console.error(`[EMAIL] ❌ Failed to send menu email to ${to}:`, error);
    throw error;
  }
}

// 3) Unified ticket with menu (one email with both QR codes)
export async function sendUnifiedTicketEmail(payload: UnifiedTicketEmailPayload) {
  const html = generateUnifiedTicketEmailHTML(payload);

  const { to, headers } = resolveTo(payload.to);
  await transporter.sendMail({
    from: buildFrom("NightLife Tickets"),
    to,
    subject: `🎟️ Tu entrada con menú: ${payload.ticketName}`,
    html,
    attachments: [getInlineLogoAttachment()],
    headers,
  });
}

// 4) Password reset (same domain; branded template)
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  const html = generatePasswordResetEmailHTML({ resetUrl });

  const { to, headers } = resolveTo(email);
  await transporter.sendMail({
    from: buildFrom("NightLife Soporte"),
    to,
    subject: "🔐 Restablece tu contraseña de NightLife",
    html,
    attachments: [getInlineLogoAttachment()],
    headers,
  });
}

// 5) Transaction Invoice: one email per transaction (complete breakdown)
export async function sendTransactionInvoiceEmail(payload: {
  to: string;
  transactionId: string;
  clubName: string;
  clubAddress?: string;
  clubPhone?: string;
  clubEmail?: string;
  date: string;
  items: Array<{
    name: string;
    variant?: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  platformFees: number;
  gatewayFees: number;
  gatewayIVA: number;
  total: number;
  currency?: string;
  paymentMethod: string;
  paymentProviderRef?: string;
  customerInfo?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    legalId?: string;
    legalIdType?: string;
    creditCard?: string;
  };
}) {
  console.log(`[EMAIL] Sending transaction invoice to: ${payload.to}`);
  console.log(`[EMAIL] Transaction: ${payload.transactionId}, Club: ${payload.clubName}, Total: ${payload.total}`);
  
  const html = generateTransactionInvoiceHTML(payload);

  const { to, headers } = resolveTo(payload.to);
  console.log(`[EMAIL] Resolved recipient: ${to}`);
  
  try {
    await transporter.sendMail({
      from: buildFrom("NightLife Facturación"),
      to,
      subject: `🧾 Factura de Compra - ${payload.clubName}`,
      html,
      attachments: [getInlineLogoAttachment()],
      headers,
    });
    console.log(`[EMAIL] ✅ Transaction invoice sent successfully to: ${to}`);
  } catch (error) {
    console.error(`[EMAIL] ❌ Failed to send transaction invoice to ${to}:`, error);
    throw error;
  }
}
