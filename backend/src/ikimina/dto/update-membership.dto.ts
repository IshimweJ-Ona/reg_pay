import { IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateMembershipDto {
  @IsOptional()
  @IsNumber()
  monthly_amount?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}