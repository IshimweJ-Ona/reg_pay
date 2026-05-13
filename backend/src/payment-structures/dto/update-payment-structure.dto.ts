import { EMPLOYMENT_TYPE } from '@prisma/client';
import { IsDateString, IsDecimal, IsEnum, IsOptional } from 'class-validator';

export class UpdatePaymentStructureDto {
  @IsOptional()
  @IsEnum(EMPLOYMENT_TYPE)
  payroll_frequency?: EMPLOYMENT_TYPE;

  @IsOptional()
  @IsDecimal()
  basic_salary?: string;

  @IsOptional()
  @IsDecimal()
  daily_rate?: string;

  @IsOptional()
  @IsDecimal()
  overtime_rate?: string;

  @IsOptional()
  @IsDecimal()
  tax_percentage?: string;

  @IsOptional()
  @IsDateString()
  effective_to?: string;
}
