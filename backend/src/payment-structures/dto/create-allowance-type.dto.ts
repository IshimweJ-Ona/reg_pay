import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAllowanceTypeDto {
  @ApiProperty({
    example: 'Transport Allowance',
    description: 'The name of the allowance type.',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '25000.00',
    description: 'Default amount suggested when this allowance type is attached to a position or employee.',
  })
  @IsDecimal()
  default_amount: string;

  @ApiPropertyOptional({
    example: 'Covers commuting costs for field staff.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
