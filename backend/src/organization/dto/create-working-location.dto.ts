import { WORKING_LOCATION_TYPE } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class CreateWorkingLocationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(WORKING_LOCATION_TYPE)
  type: WORKING_LOCATION_TYPE;

  @IsString()
  @IsNotEmpty()
  address: string;
}
