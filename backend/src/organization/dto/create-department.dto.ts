import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @ApiPropertyOptional({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'The UUID of the working location this department belongs to.',
  })
  @IsOptional()
  @IsString()
  working_location_id?: string;

  @ApiProperty({
    example: 'FIN-01',
    description: 'Unique code for the department.',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Finance Department',
    description: 'Full name of the department.',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Responsible for all financial operations and payroll accounting.',
    description: "Detailed description of the department's role.",
  })
  @IsOptional()
  @IsString()
  description?: string;
}
