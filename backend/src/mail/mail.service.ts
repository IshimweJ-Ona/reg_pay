import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST/PORT/USER/PASS missing) — emails will be logged, not sent.',
      );
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
    return this.transporter;
  }

  private async send(to: string, subject: string, html: string) {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM || 'REG Pay <no-reply@regpay.local>';

    if (!transporter) {
      this.logger.log(`[SMTP not configured] Would send to ${to}: ${subject}`);
      return;
    }

    try {
      await transporter.sendMail({ from, to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string, expiresAt: Date) {
    const expiresLocal = expiresAt.toUTCString();
    await this.send(
      to,
      'Reset your REG Pay password',
      `<p>We received a request to reset your REG Pay password.</p>
       <p><a href="${resetUrl}">Click here to reset your password</a></p>
       <p>This link expires at ${expiresLocal}. If you didn't request this, you can ignore this email.</p>`,
    );
  }

  async sendVerificationCodeEmail(to: string, code: string, expiresAt: Date) {
    const expiresLocal = expiresAt.toUTCString();
    await this.send(
      to,
      'Your REG Pay verification code',
      `<p>Your account has been approved. Use the code below to verify your account and sign in:</p>
       <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
       <p>This code expires at ${expiresLocal}.</p>`,
    );
  }
}
