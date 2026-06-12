import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { buildVerificationEmail } from './verification-email.template';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');

    if (!host) {
      // Dev mode: no real SMTP configured — print to console so the dev can
      // copy the link without setting up an email server.
      console.log(`\n[MailService] Verification link for ${to}:\n${link}\n`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT', '587')),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    const { subject, text, html } = buildVerificationEmail(link);
    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM'),
      to,
      subject,
      text,
      html,
    });
  }
}
