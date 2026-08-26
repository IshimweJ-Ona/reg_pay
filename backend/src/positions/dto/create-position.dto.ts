import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePositionDto {
  @ApiProperty({
    example: 'Driver',
    maxLength: 100,
    description: 'Unique name of the position.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Operates and maintains company vehicles for field operations.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
