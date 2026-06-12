import { IsEmail } from 'class-validator';

/** Body for POST /auth/resend-verification — re-sends the email-verification
 *  link for an unverified account. Only the email is needed; the response is
 *  deliberately identical whether or not the account exists (no enumeration). */
export class ResendVerificationDto {
  @IsEmail()
  email: string;
}
