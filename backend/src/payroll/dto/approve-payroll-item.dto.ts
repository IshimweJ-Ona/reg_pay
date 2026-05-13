import { IsOptional, IsString } from 'class-validator';

export class ApprovePayrollItemDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
