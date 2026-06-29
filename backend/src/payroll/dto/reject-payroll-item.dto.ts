import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPayrollItemDto {
  @IsString()
  @IsNotEmpty()
  rejection_reason?: string;
}
