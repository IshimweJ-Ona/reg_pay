import { ApiPropertyOptional } from '@nestjs/swagger';
import { DEDUCTION_MODE } from '@prisma/client';
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateDeductionTypeDto {
  @ApiPropertyOptional({
    example: 'Life Insurance',
    description: 'Updated name of the deduction type.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    enum: DEDUCTION_MODE,
    example: DEDUCTION_MODE.PERCENTAGE,
    description: 'Update deduction mode to FIXED or PERCENTAGE.',
  })
  @IsOptional()
  @IsEnum(DEDUCTION_MODE)
  deduction_mode?: DEDUCTION_MODE;

  @ApiPropertyOptional({
    example: '7000.00',
    description: 'Updated fixed amount for the deduction.',
  })
  @IsOptional()
  @IsDecimal()
  amount?: string;

  @ApiPropertyOptional({
    example: '3.5',
    description: 'Updated percentage value for the deduction.',
  })
  @IsOptional()
  @IsDecimal()
  percentage_value?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Update whether this deduction is mandatory.',
  })
  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;
}
