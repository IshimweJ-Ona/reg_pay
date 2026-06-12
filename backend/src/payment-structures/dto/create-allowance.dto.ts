import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAllowanceDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'The UUID of the employee receiving the allowance.',
  })
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty({
    example: 'Transport Allowance',
    description: 'The name or title of the allowance.',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: '50000.00',
    description: 'The amount of the allowance in RWF.',
  })
  @IsDecimal()
  amount: string;

  @ApiPropertyOptional({
    example: 'Monthly transport allowance for field staff.',
    description: 'Optional description of why the allowance is granted.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
