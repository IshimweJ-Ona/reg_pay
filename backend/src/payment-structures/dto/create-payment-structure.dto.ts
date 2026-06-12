import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'The UUID of the employee this payment structure is for.',
  })
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty({
    enum: EMPLOYMENT_TYPE,
    example: EMPLOYMENT_TYPE.MONTHLY,
    description: 'Payment frequency (e.g., MONTHLY, DAILY).',
  })
  @IsEnum(EMPLOYMENT_TYPE)
  payroll_frequency: EMPLOYMENT_TYPE;

  @ApiProperty({
    example: '800000.00',
    description: 'The monthly basic salary of the employee in RWF.',
  })
  @IsDecimal()
  basic_salary: string;

  @ApiProperty({
    example: '30000.00',
    description:
      'The daily rate for the employee in RWF (used for daily workers).',
  })
  @IsDecimal()
  daily_rate: string;

  @ApiProperty({
    example: '1.5',
    description: 'The multiplier for overtime hours (e.g., 1.5 for 150%).',
  })
  @IsDecimal()
  overtime_rate: string;

  @ApiProperty({
    example: '15.0',
    description: 'The applicable tax percentage for this employee.',
  })
  @IsDecimal()
  tax_percentage: string;

  @ApiPropertyOptional({
    example: 22,
    description:
      'Optional custom number of working days in a month for this employee.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  custom_work_days?: number;

  @ApiProperty({
    example: '2024-01-01',
    description:
      'The date from which this payment structure becomes effective.',
  })
  @IsDateString()
  effective_from: string;
}
