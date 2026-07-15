import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateMembershipDto {
  @IsString()
  employee_id: string;

  @IsNumber()
  monthly_amount: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}