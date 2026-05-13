import { GENDER } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsString()
  @IsNotEmpty()
  first_name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone_number?: string;

  @IsOptional()
  @IsString()
  national_id?: string;

  @IsEnum(GENDER)
  gender: GENDER;

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
