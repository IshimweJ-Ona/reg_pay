import { IsString, IsOptional } from 'class-validator';

export class StreamQueryDto {
  @IsOptional()
  @IsString()
  token!: string;
}
