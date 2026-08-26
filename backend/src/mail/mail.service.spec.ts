import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailService', () => {
  const originalEnv = process.env;
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'REG Pay <mailer@example.com>',
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends admin-created account setup email with text and html but no password', async () => {
    const service = new MailService();
    const expiresAt = new Date('2026-08-26T12:00:00.000Z');
    const setPasswordUrl =
      'https://reg-pay.example.com/auth/reset-password/setup-token';

    await service.sendUserCreatedEmail('new.user@reg.rw', {
      recipientName: 'New User',
      creatorName: 'System Administrator',
      creatorEmail: 'admin@reg.rw',
      roleNames: ['BRANCH_MANAGER'],
      setPasswordUrl,
      expiresAt,
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'REG Pay <mailer@example.com>',
        to: 'new.user@reg.rw',
        subject: 'Set up your REG Pay account',
        text: expect.stringContaining(setPasswordUrl),
        html: expect.stringContaining(setPasswordUrl),
      }),
    );

    const payload = sendMail.mock.calls[0][0];
    expect(payload.text).toContain('This one-time link expires at');
    expect(payload.html).toContain('Set your REG Pay password');
    expect(payload.text).not.toContain('Password:');
    expect(payload.html).not.toContain('<strong>Password:</strong>');
  });

  it('sends password reset email with both text and html bodies', async () => {
    const service = new MailService();
    const expiresAt = new Date('2026-08-26T12:00:00.000Z');
    const resetUrl = 'https://reg-pay.example.com/auth/reset-password/token';

    await service.sendPasswordResetEmail('user@reg.rw', resetUrl, expiresAt);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@reg.rw',
        subject: 'Reset your REG Pay password',
        text: expect.stringContaining(resetUrl),
        html: expect.stringContaining(resetUrl),
      }),
    );
  });
});
