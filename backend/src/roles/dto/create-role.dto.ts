import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permission_keys?: string[];

  // Only meaningful for an actor with full roles.manage — a
  // roles.manage_own_location actor always has this forced to their own
  // branch server-side, ignoring whatever they send here.
  @IsString()
  @IsOptional()
  working_location_id?: string;
}
