import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  module_name: string;

  @IsString()
  @IsNotEmpty()
  permission_key: string;
}
