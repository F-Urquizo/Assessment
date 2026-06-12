import { buildVerificationEmail } from './verification-email.template';

describe('buildVerificationEmail', () => {
  const link = 'http://localhost:5173/verify-email?token=raw123';

  it('includes the verification link in both html and text bodies', () => {
    const { html, text } = buildVerificationEmail(link);

    expect(text).toContain(link);
    // Twice in the HTML: the CTA button and the copy-paste fallback.
    expect(html.split(link).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('carries the brand subject and expiry notice', () => {
    const { subject, html, text } = buildVerificationEmail(link);

    expect(subject).toContain('Bluebook');
    expect(html).toContain('24 hours');
    expect(text).toContain('24 hours');
  });

  it('warns recipients who did not create the account (anti-phishing note)', () => {
    const { html, text } = buildVerificationEmail(link);

    expect(html).toContain('you can safely ignore this email');
    expect(text).toContain('you can safely ignore this email');
  });

  it('uses email-safe markup: inline styles, tables, no external resources', () => {
    const { html } = buildVerificationEmail(link);

    expect(html).toContain('<table role="presentation"');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script');
    // No remote images/fonts — avoids "load images?" warnings and tracking flags.
    expect(html).not.toMatch(/src=["']http/);
  });
});
