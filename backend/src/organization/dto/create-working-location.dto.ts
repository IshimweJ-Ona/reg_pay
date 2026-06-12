import { ApiProperty } from '@nestjs/swagger';
import { WORKING_LOCATION_TYPE } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateWorkingLocationDto {
  @ApiProperty({
    example: 'Kigali Head Office',
    description: 'The name of the working location or branch.',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: WORKING_LOCATION_TYPE,
    example: WORKING_LOCATION_TYPE.HQ,
    description: 'The type of location (e.g., HEAD_QUARTER, BRANCH).',
  })
  @IsEnum(WORKING_LOCATION_TYPE)
  type: WORKING_LOCATION_TYPE;

  @ApiProperty({
    example: 'KN 2 St, Kigali, Rwanda',
    description: 'Physical address of the location.',
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}
