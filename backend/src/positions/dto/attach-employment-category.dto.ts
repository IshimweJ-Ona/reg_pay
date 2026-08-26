import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDecimal,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AttachEmploymentCategoryDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description:
      'UUID (or id) of the employment category (Monthly / Daily / Custom) to attach as a variant of this position.',
  })
  @IsString()
  @IsNotEmpty()
  employment_category_id: string;

  @ApiPropertyOptional({
    example: '380000.00',
    description: 'Default monthly basic salary for employees on this position + category.',
  })
  @IsOptional()
  @IsDecimal()
  default_basic_salary?: string;

  @ApiPropertyOptional({
    example: '6000.00',
    description: 'Default daily rate for employees on this position + category.',
  })
  @IsOptional()
  @IsDecimal()
  default_daily_rate?: string;

  @ApiPropertyOptional({
    example: '2500.00',
    description: 'Default overtime rate for employees on this position + category.',
  })
  @IsOptional()
  @IsDecimal()
  default_overtime_rate?: string;

  @ApiPropertyOptional({
    example: 20,
    description:
      'Default custom-contract work days for this position + category (a UI hint only - ' +
      "each employee's actual pay is always daily_rate x their own real contract dates).",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  default_custom_work_days?: number;
}
