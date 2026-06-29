import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferEmployeeDto {
  @ApiProperty({
    example: 'loc-uuid',
    description: 'Target workig location id',
  })
  @IsString()
  @IsNotEmpty()
  working_location_id?: string;

  @ApiProperty({ example: 'dept-uuid' })
  @IsString()
  @IsNotEmpty()
  department_id?: string;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsString()
  employment_category_id?: string;

  @ApiPropertyOptional({ example: 'Transfer reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}
