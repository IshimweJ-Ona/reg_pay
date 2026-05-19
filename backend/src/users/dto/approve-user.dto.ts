import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class ApproveUserDto {
  @IsOptional()
  @IsString()
  working_location_id: string;

  @IsOptional()
  @IsString()
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
