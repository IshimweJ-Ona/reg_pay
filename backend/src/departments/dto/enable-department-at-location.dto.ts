import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class EnableDepartmentAtLocationDto {
  @ApiProperty({
    example: 'Finance Department',
    maxLength: 100,
    description:
      'Full department name, used only when a fresh row must be created for this location (ignored when reactivating an existing archived row).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Responsible for all financial operations and payroll accounting.',
    description: 'Optional description, used only when creating a fresh row.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
