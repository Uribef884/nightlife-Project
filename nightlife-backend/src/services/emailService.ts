import nodemailer from "nodemailer";
import { generateTicketEmailHTML } from "../templates/ticketEmailTemplate";
import { generateMenuEmailHTML } from "../templates/menuEmailTemplate";
import { generateMenuFromTicketEmailHTML } from "../templates/menuFromTicketEmailTemplate";
import { generatePasswordResetEmailHTML } from "../templates/passwordResetEmailTemplate";

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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendTicketEmail(payload: TicketEmailPayload) {
  const html = generateTicketEmailHTML({
    ...payload,
    email: payload.to,
  });

  await transporter.sendMail({
    from: `"NightLife Tickets" <${process.env.SMTP_USER}>`,
    to: payload.to,
    subject: `🎟️ Your Ticket for ${payload.ticketName}`,
    html,
  });
}

export async function sendMenuEmail(payload: MenuEmailPayload) {
  const html = generateMenuEmailHTML(payload);

  await transporter.sendMail({
    from: `"NightLife Menu" <${process.env.SMTP_USER}>`,
    to: payload.to,
    subject: `🍹 Your Menu QR from ${payload.clubName}`,
    html,
  });
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    console.log('📧 [EMAIL_SERVICE] Sending password reset email to:', email);
    console.log('🔗 [EMAIL_SERVICE] Reset URL:', resetUrl);

    const html = generatePasswordResetEmailHTML({ resetUrl });

    // Verify SMTP configuration
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP configuration missing. Please check SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
    }

    console.log('📧 [EMAIL_SERVICE] SMTP config verified, sending email...');

    await transporter.sendMail({
      from: `"NightLife Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "🔐 Reset Your NightLife Password",
      html,
    });

    console.log('✅ [EMAIL_SERVICE] Password reset email sent successfully to:', email);
  } catch (error) {
    console.error('❌ [EMAIL_SERVICE] Failed to send password reset email:', error);
    throw error;
  }
}

export async function sendMenuFromTicketEmail(payload: MenuFromTicketEmailPayload) {
  const html = generateMenuFromTicketEmailHTML(payload);

  await transporter.sendMail({
    from: `"NightLife Menu" <${process.env.SMTP_USER}>`,
    to: payload.to,
    subject: `🍹 Your Included Menu Items for ${payload.ticketName}`,
    html,
  });
}
