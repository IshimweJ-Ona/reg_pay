import { IsNotEmpty, IsString } from 'class-validator';

export class AssignUserPermissionDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  permission_key: string;
}
