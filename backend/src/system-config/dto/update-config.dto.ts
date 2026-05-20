import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class BatchUpdateConfigDto {
  @IsNotEmpty()
  configs: UpdateConfigDto[];
}
