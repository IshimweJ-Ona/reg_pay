import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateEmployeeDeductionDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'The UUID of the employee this deduction applies to.',
  })
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'The UUID of the deduction type (e.g., RSSB, RAMA).',
  })
  @IsString()
  @IsNotEmpty()
  deduction_type_id: string;

  @ApiProperty({
    example: '2024-01-01',
    description: 'The date from which the deduction becomes active.',
  })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description:
      'Optional end date for the deduction (e.g., for short-term loans).',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this deduction is currently active.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
