import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  working_location_id?: string;

  @IsOptional()
  @IsString()
  department_id?: string | null;
}
