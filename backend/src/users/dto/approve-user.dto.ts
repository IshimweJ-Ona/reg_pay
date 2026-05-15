import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ApproveUserDto {
  @IsString()
  @IsNotEmpty()
  working_location_id: string;

  @IsString()
  @IsNotEmpty()
  department_id: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  role_ids?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permission_ids?: string[];
}
