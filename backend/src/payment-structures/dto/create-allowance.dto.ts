import { IsDecimal, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAllowanceDto {
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDecimal()
  amount: string;

  @IsOptional()
  @IsString()
  description?: string;
}
