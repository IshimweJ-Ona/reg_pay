import { PAYMENT_METHOD } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePayrollBatchDto {
  @IsString()
  @IsNotEmpty()
  working_location_id: string;

  @IsInt()
  @Min(1)
  @Max(12)
  payroll_month: number;

  @IsInt()
  @Min(2000)
  payroll_year: number;

  @IsDateString()
  payment_date: string;

  @IsEnum(PAYMENT_METHOD)
  payment_method: PAYMENT_METHOD;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  work_days?: number;

  @IsOptional()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  overrides?: Array<{
    employee_id: string;
    base_amount?: number;
    phone_number?: string;
  }>;
}
