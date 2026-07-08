import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { WORKING_LOCATION_TYPE } from '@prisma/client';

export class CreateWorkingLocationDto {
  @ApiProperty({ example: 'Kigali HQ', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: WORKING_LOCATION_TYPE })
  @IsEnum(WORKING_LOCATION_TYPE)
  type: WORKING_LOCATION_TYPE;

  @ApiProperty({ example: 'KG 7 Ave, Kigali', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;
}