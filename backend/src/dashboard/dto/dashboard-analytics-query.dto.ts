import { employees_status, payment_batches_status } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class EmployeeAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  working_location_id?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  position_id?: string;

  @IsOptional()
  @IsString()
  employment_category_id?: string;

  @IsOptional()
  @IsEnum(employees_status)
  status?: employees_status;
}

export class PayrollAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  working_location_id?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  position_id?: string;

  @IsOptional()
  @IsEnum(payment_batches_status)
  status?: payment_batches_status;
}
