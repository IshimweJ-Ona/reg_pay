import { ApiPropertyOptional } from '@nestjs/swagger';
import { EMPLOYMENT_TYPE } from '@prisma/client';
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdatePaymentStructureDto {
  @ApiPropertyOptional({
    enum: EMPLOYMENT_TYPE,
    example: EMPLOYMENT_TYPE.DAILY,
    description: 'Updated payment frequency.',
  })
  @IsOptional()
  @IsEnum(EMPLOYMENT_TYPE)
  payroll_frequency?: EMPLOYMENT_TYPE;

  @ApiPropertyOptional({
    example: '850000.00',
    description: 'Updated basic salary.',
  })
  @IsOptional()
  @IsDecimal()
  basic_salary?: string;

  @ApiPropertyOptional({
    example: '32000.00',
    description: 'Updated daily rate.',
  })
  @IsOptional()
  @IsDecimal()
  daily_rate?: string;

  @ApiPropertyOptional({
    example: '2.0',
    description: 'Updated overtime multiplier.',
  })
  @IsOptional()
  @IsDecimal()
  overtime_rate?: string;

  @ApiPropertyOptional({
    example: '18.0',
    description: 'Updated tax percentage.',
  })
  @IsOptional()
  @IsDecimal()
  tax_percentage?: string;

  @ApiPropertyOptional({
    example: 24,
    description: 'Updated custom working days.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  custom_work_days?: number;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'The date until which this payment structure is effective.',
  })
  @IsOptional()
  @IsDateString()
  effective_to?: string;
}
