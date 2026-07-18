import { ApiPropertyOptional } from '@nestjs/swagger';
import { payment_structures_payroll_frequency } from '@prisma/client';
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
    enum: payment_structures_payroll_frequency,
    example: payment_structures_payroll_frequency.DAILY,
    description: 'Updated payment frequency.',
  })
  @IsOptional()
  @IsEnum(payment_structures_payroll_frequency)
  payroll_frequency?: payment_structures_payroll_frequency;

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
    example: '2024-12-31',
    description: 'The date until which this payment structure is effective.',
  })
  @IsOptional()
  @IsDateString()
  effective_to?: string;
}