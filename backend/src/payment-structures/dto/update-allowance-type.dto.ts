import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDecimal, IsOptional, IsString } from 'class-validator';

export class UpdateAllowanceTypeDto {
  @ApiPropertyOptional({ example: 'Housing Allowance' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '30000.00' })
  @IsOptional()
  @IsDecimal()
  default_amount?: string;

  @ApiPropertyOptional({ example: 'Updated description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Deactivate this allowance type so it no longer appears as a pickable option (existing attachments are untouched).',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
