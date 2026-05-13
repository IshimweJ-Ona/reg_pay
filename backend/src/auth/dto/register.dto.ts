import { GENDER } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(GENDER)
  gender: GENDER;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  working_location_id?: string;
}
