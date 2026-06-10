import { IsEmail, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from './constants';

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(PASSWORD_MIN_LENGTH)
  password: string;
}
