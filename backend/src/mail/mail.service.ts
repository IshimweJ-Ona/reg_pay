import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type UserCreatedEmailInput = {
  recipientName: string;
  creatorName: string;
  creatorEmail: string;
  roleNames: string[];
  setPasswordUrl: string;
  expiresAt: Date;
};

type MailContent = {
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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

  private async send(to: string, subject: string, content: MailContent) {
    const transporter = this.getTransporter();
    const from = process.env.SMTP_FROM || 'REG Pay <no-reply@regpay.local>';

    if (!transporter) {
      this.logger.log(`[SMTP not configured] Would send to ${to}: ${subject}`);
      return;
    }

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text: content.text,
        html: content.html,
      });
    } catch (error: any) {
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
      {
        text: [
          'We received a request to reset your REG Pay password.',
          '',
          `Reset your password: ${resetUrl}`,
          '',
          `This link expires at ${expiresLocal}.`,
          "If you didn't request this, you can ignore this email.",
        ].join('\n'),
        html: `<p>We received a request to reset your REG Pay password.</p>
         <p><a href="${this.escapeHtml(resetUrl)}">Click here to reset your password</a></p>
         <p>This link expires at ${this.escapeHtml(expiresLocal)}. If you didn't request this, you can ignore this email.</p>`,
      },
    );
  }

  async sendVerificationCodeEmail(to: string, code: string, expiresAt: Date) {
    const expiresLocal = expiresAt.toUTCString();
    await this.send(
      to,
      'Your REG Pay verification code',
      {
        text: [
          'Your account has been approved.',
          '',
          `Verification code: ${code}`,
          '',
          `This code expires at ${expiresLocal}.`,
        ].join('\n'),
        html: `<p>Your account has been approved. Use the code below to verify your account and sign in:</p>
         <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${this.escapeHtml(code)}</p>
         <p>This code expires at ${this.escapeHtml(expiresLocal)}.</p>`,
      },
    );
  }

  async sendUserCreatedEmail(to: string, input: UserCreatedEmailInput) {
    const roleText = input.roleNames.length
      ? input.roleNames.join(', ')
      : 'No role assigned';
    const expiresLocal = input.expiresAt.toUTCString();

    await this.send(
      to,
      'Set up your REG Pay account',
      {
        text: [
          `Hello ${input.recipientName},`,
          '',
          `${input.creatorName} (${input.creatorEmail}) created your REG Pay account.`,
          `Role: ${roleText}`,
          `Email: ${to}`,
          '',
          `Set your password: ${input.setPasswordUrl}`,
          '',
          `This one-time link expires at ${expiresLocal}.`,
          'If you were not expecting this account, contact your administrator.',
        ].join('\n'),
        html: `<p>Hello ${this.escapeHtml(input.recipientName)},</p>
         <p>${this.escapeHtml(input.creatorName)} (${this.escapeHtml(input.creatorEmail)}) created your REG Pay account.</p>
         <p><strong>Role:</strong> ${this.escapeHtml(roleText)}</p>
         <p><strong>Email:</strong> ${this.escapeHtml(to)}</p>
         <p><a href="${this.escapeHtml(input.setPasswordUrl)}">Set your REG Pay password</a></p>
         <p>This one-time link expires at ${this.escapeHtml(expiresLocal)}.</p>
         <p>If you were not expecting this account, contact your administrator.</p>`,
      },
    );
  }
}
