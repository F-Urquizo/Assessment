/**
 * Branded HTML template for the account-verification email.
 *
 * Email-client constraints shape everything here: layout uses nested tables
 * (flex/grid are unsupported in Outlook), every style is inline (many clients
 * strip <style> blocks), system fonts only (webfonts are blocked), and the CTA
 * is a padded <a> rendered as a button (clickable area works everywhere).
 * Palette mirrors the app: paper #f2ecdd, ink #20251f, green #1d3a2a,
 * amber #c4551c.
 */

export interface VerificationEmailParts {
  subject: string;
  text: string;
  html: string;
}

export function buildVerificationEmail(link: string): VerificationEmailParts {
  const subject = 'Verify your email — Bluebook';

  // Plain-text fallback: shown by text-only clients and used for previews.
  const text = [
    'Welcome to Bluebook!',
    '',
    'Confirm your email address to activate your account:',
    link,
    '',
    'This link expires in 24 hours and can only be used once.',
    'If you did not create a Bluebook account, you can safely ignore this email.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#e9e1cc;">
  <!-- Preheader: preview text shown next to the subject in inboxes -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Confirm your email to activate your Bluebook account. The link expires in 24 hours.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e9e1cc; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">

          <!-- Masthead -->
          <tr>
            <td style="background-color:#1d3a2a; padding:28px 36px; border:2px solid #20251f;">
              <span style="font-family:Georgia, 'Times New Roman', serif; font-style:italic; font-size:30px; color:#f2ecdd; letter-spacing:0.5px;">
                Bluebook
              </span>
              <span style="font-family:'Courier New', Courier, monospace; font-size:11px; color:#e06a23; letter-spacing:3px; text-transform:uppercase; display:block; margin-top:6px;">
                Vehicle Intelligence
              </span>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#f6f1e4; padding:36px; border:2px solid #20251f; border-top:none;">
              <h1 style="margin:0 0 16px; font-family:Georgia, 'Times New Roman', serif; font-weight:normal; font-size:24px; color:#20251f;">
                One last step —<br>confirm your email
              </h1>

              <p style="margin:0 0 28px; font-family:'Courier New', Courier, monospace; font-size:14px; line-height:1.7; color:#20251f;">
                Thanks for creating a Bluebook account. Click the button below to
                verify this address and unlock favorites, selling and personalized
                recommendations.
              </p>

              <!-- Bulletproof CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background-color:#1d3a2a; border:2px solid #20251f;">
                    <a href="${link}"
                       style="display:inline-block; padding:15px 34px; font-family:'Courier New', Courier, monospace; font-size:13px; font-weight:bold; letter-spacing:3px; text-transform:uppercase; color:#f2ecdd; text-decoration:none;">
                      Verify my email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px; font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.6; color:#5a5f58;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px; font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.6; word-break:break-all;">
                <a href="${link}" style="color:#c4551c;">${link}</a>
              </p>

              <hr style="border:none; border-top:1px solid rgba(32,37,31,0.25); margin:0 0 20px;">

              <p style="margin:0; font-family:'Courier New', Courier, monospace; font-size:12px; line-height:1.7; color:#5a5f58;">
                &#9888; This link expires in <strong style="color:#c4551c;">24 hours</strong>
                and can only be used once.<br>
                If you didn&rsquo;t create this account, you can safely ignore this email
                &mdash; no account will be activated.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;" align="center">
              <p style="margin:0; font-family:'Courier New', Courier, monospace; font-size:11px; letter-spacing:1px; color:#5a5f58;">
                Bluebook &middot; Random-Forest Vehicle Intelligence<br>
                This is an automated message &mdash; please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
