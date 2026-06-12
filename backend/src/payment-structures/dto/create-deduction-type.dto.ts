import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEDUCTION_MODE } from '@prisma/client';
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
    enum: DEDUCTION_MODE,
    example: DEDUCTION_MODE.FIXED,
    description:
      'Whether the deduction is a FIXED amount or a PERCENTAGE of basic salary.',
  })
  @IsEnum(DEDUCTION_MODE)
  deduction_mode: DEDUCTION_MODE;

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
