import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

export class AssignUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  role_ids: string[];
}
