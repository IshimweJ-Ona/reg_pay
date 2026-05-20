import { GENDER } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsArray,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com)$/, {
    message: 'Email must be a valid @gmail.com or @reg.com address.',
  })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+2507[2389][0-9]{7}$/, {
    message: 'Phone number must be a valid Rwanda number (+2507...).',
  })
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  role_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permission_ids?: string[];
}
