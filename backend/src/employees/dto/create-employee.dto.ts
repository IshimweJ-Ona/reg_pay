import { GENDER } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com)$/, {
    message: 'Email must be a valid @gmail.com or @reg.com address.',
  })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+2507[2389][0-9]{7}$/, {
    message: 'Phone number must be a valid Rwanda number (+2507...).',
  })
  phone_number?: string;

  @IsOptional()
  @IsString()
  national_id?: string;

  @IsOptional()
  @IsEnum(GENDER)
  gender?: GENDER;

  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  working_location_id?: string;

  @IsOptional()
  @IsString()
  employment_category_id?: string;
}
