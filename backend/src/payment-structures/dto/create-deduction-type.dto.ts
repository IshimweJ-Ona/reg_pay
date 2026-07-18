import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { deduction_types_deduction_mode } from '@prisma/client';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDeductionTypeDto {
  @ApiProperty({
    example: 'Health Insurance',
    description: 'The name of the deduction type.',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: deduction_types_deduction_mode,
    example: deduction_types_deduction_mode.FIXED,
    description:
      'Whether the deduction is a FIXED amount or a PERCENTAGE of basic salary.',
  })
  @IsEnum(deduction_types_deduction_mode)
  deduction_mode: deduction_types_deduction_mode;

  @ApiPropertyOptional({
    example: '5000.00',
    description: 'The fixed amount to be deducted (required if mode is FIXED).',
  })
  @IsOptional()
  @IsDecimal()
  amount?: string;

  @ApiPropertyOptional({
    example: '5.0',
    description:
      'The percentage to be deducted (required if mode is PERCENTAGE).',
  })
  @IsOptional()
  @IsDecimal()
  percentage_value?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'If true, this deduction is automatically applied to all eligible employees.',
  })
  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;
}