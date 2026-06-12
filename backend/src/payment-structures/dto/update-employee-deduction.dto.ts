import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateEmployeeDeductionDto {
  @ApiPropertyOptional({
    example: '2024-02-01',
    description: 'Updated start date for the employee deduction.',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({
    example: '2024-11-30',
    description: 'Updated end date for the employee deduction.',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Update the active status of this deduction.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
