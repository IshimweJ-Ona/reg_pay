import { IsOptional, IsString } from 'class-validator';

export class SuspendEmployeeDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
