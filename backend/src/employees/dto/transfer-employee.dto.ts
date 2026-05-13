import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class TransferEmployeeDto {
  @IsString()
  @IsNotEmpty()
  working_location_id: string;

  @IsString()
  @IsNotEmpty()
  department_id: string;

  @IsOptional()
  @IsString()
  employment_category_id?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
