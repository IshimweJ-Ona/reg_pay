import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RequestTransferDto {
  @IsString()
  @IsNotEmpty()
  working_location_id: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
