import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { working_locations_type } from '@prisma/client';

export class CreateWorkingLocationDto {
  @ApiProperty({ example: 'Kigali HQ', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: working_locations_type })
  @IsEnum(working_locations_type)
  type: working_locations_type;

  @ApiProperty({ example: 'KG 7 Ave, Kigali', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;
}