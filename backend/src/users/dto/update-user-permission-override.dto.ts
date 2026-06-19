import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserPermissionOverrideDto {
  @IsBoolean()
  is_allowed!: boolean;

  @IsOptional()
  @IsString()
  reason!: string;
}
