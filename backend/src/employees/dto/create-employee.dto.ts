import { person_gender } from '@prisma/client';
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({
    example: 'John',
    description: 'Employee first name',
  })
  @IsString()
  @IsNotEmpty()
  first_name?: string;

  @ApiProperty({
    example: 'Mugisha',
    description: 'Employee last name',
  })
  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @ApiPropertyOptional({
    example: 'johnmugisha@gmail.com',
    description: 'Must be a valid @gmail.com, @yahoo.com or @reg.rw address.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com|yahoo\.com|reg\.rw)$/, {
    message: 'Email must be a valid @gmail.com, @yahoo.com or @reg.rw address.',
  })
  email?: string;

  @ApiPropertyOptional({
    example: '+250788628835',
    description: 'Valid Rwanda mobile number must start with +2507[00000000].',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+2507[2389][0-9]{7}$/, {
    message: 'Phone number must be a valid Rwanda number (+2507...).',
  })
  phone_number?: string;

  @ApiPropertyOptional({
    example: '16 digits',
    description:
      'Rwanda national ID exactly 16 digits (format: 1YYYYXXXXXXXXXX).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{16}$/, {
    message: 'National ID must be exactly 16 digits.',
  })
  national_id?: string;

  @ApiPropertyOptional({
    enum: person_gender,
    example: person_gender.MALE,
    description: 'Employee gender.',
  })
  @IsOptional()
  @IsEnum(person_gender)
  gender?: person_gender;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2022-01-15',
    description: 'ISO 8601 date string for the employee hire date.',
  })
  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-01-01',
    description:
      'Contract start date. Required (together with contract_end_date) for ' +
      'CUSTOM (fixed-term) employees so their contract total can be ' +
      'auto-calculated as daily_rate x contract days.',
  })
  @IsOptional()
  @IsDateString()
  contract_start_date?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-06-30',
    description:
      'Contract end date. Required (together with contract_start_date) for ' +
      'CUSTOM (fixed-term) employees so their contract total can be ' +
      'auto-calculated as daily_rate x contract days.',
  })
  @IsOptional()
  @IsDateString()
  contract_end_date?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID of the department this employee belongs to.',
  })
  @IsOptional()
  @IsString()
  department_id?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID of the working location (branch) this employee is assigned to.',
  })
  @IsOptional()
  @IsString()
  working_location_id?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID of the employment category (Monthly / Daily / Custom) ' +
      'that determines payroll frequency and tax behaviour.',
  })
  @IsOptional()
  @IsString()
  employment_category_id?: string;

  // Unified update fields
  @ApiPropertyOptional({
    example: '500000',
    description: 'Basic salary or daily rate',
  })
  @IsOptional()
  @IsString()
  basic_salary?: string;

  @ApiPropertyOptional({
    example: '0',
    description: 'Daily rate for daily/custom categories',
  })
  @IsOptional()
  @IsString()
  daily_rate?: string;

  @ApiPropertyOptional({ example: '0', description: 'Tax percentage override' })
  @IsOptional()
  @IsString()
  tax_percentage?: string;



  @ApiPropertyOptional({
    example: 'Transport Allowance',
    description: 'Main allowance title',
  })
  @IsOptional()
  @IsString()
  allowance_title?: string;

  @ApiPropertyOptional({
    example: '50000',
    description: 'Main allowance amount',
  })
  @IsOptional()
  @IsString()
  allowance_amount?: string;
}
