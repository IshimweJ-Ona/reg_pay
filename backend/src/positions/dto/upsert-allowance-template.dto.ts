import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertAllowanceTemplateDto {
  @ApiProperty({
    example: 'Transport Allowance',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    example: '25000.00',
    description: 'Default amount suggested for this allowance template.',
  })
  @IsDecimal()
  default_amount: string;

  @ApiPropertyOptional({ example: 'Covers commuting costs for field staff.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '3',
    description: 'Allowance type id this template was picked from (see /payment-structures/allowance-types).',
  })
  @IsOptional()
  @IsString()
  allowance_type_id?: string;
}
