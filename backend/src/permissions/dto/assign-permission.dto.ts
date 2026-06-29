import { IsNotEmpty, IsString } from 'class-validator';

export class AssignPermissionDto {
  @IsString()
  @IsNotEmpty()
  role_id: string;

  @IsString()
  @IsNotEmpty()
  permission_key: string;
}
