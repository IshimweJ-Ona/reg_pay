import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { payment_structures_payroll_frequency } from '@prisma/client';
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
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'The UUID of the employee this payment structure is for.',
  })
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty({
    enum: payment_structures_payroll_frequency,
    example: payment_structures_payroll_frequency.MONTHLY,
    description: 'Payment frequency (e.g., MONTHLY, DAILY).',
  })
  @IsEnum(payment_structures_payroll_frequency)
  payroll_frequency: payment_structures_payroll_frequency;

  @ApiPropertyOptional({
    example: '800000.00',
    description:
      'The monthly basic salary of the employee in RWF. For CUSTOM ' +
      '(fixed-term) employees this is auto-calculated as daily_rate x ' +
      "contract days from the employee's contract dates, so it can be " +
      'omitted; any value supplied here is ignored for CUSTOM contracts.',
  })
  @IsOptional()
  @IsDecimal()
  basic_salary?: string;

  @ApiProperty({
    example: '30000.00',
    description:
      'The daily rate for the employee in RWF (used for daily workers).',
  })
  @IsDecimal()
  daily_rate: string;

  @ApiPropertyOptional({
    example: '0',
    description:
      'Deprecated: overtime is now paid at a flat platform-wide rate per ' +
      'hour (default 2,500 RWF/hr, configurable in system settings), so ' +
      'this per-employee multiplier is no longer used in payroll ' +
      'calculations. Kept for backward compatibility only.',
  })
  @IsOptional()
  @IsDecimal()
  overtime_rate?: string;

  @ApiProperty({
    example: '15.0',
    description: 'The applicable tax percentage for this employee.',
  })
  @IsDecimal()
  tax_percentage: string;



  @ApiProperty({
    example: '2024-01-01',
    description:
      'The date from which this payment structure becomes effective.',
  })
  @IsDateString()
  effective_from: string;
}