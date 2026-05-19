import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateEmployeeDeductionDto {
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
