import { PAYMENT_METHOD } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
}
