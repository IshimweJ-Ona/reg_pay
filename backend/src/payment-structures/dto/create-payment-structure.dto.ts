import { EMPLOYMENT_TYPE } from '@prisma/client';
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsString,
} from 'class-validator';

export class CreatePaymentStructureDto {
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @IsEnum(EMPLOYMENT_TYPE)
  payroll_frequency: EMPLOYMENT_TYPE;

  @IsDecimal()
  basic_salary: string;

  @IsDecimal()
  daily_rate: string;

  @IsDecimal()
  overtime_rate: string;

  @IsDecimal()
  tax_percentage: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  custom_work_days?: number;

  @IsDateString()
  effective_from: string;
}
