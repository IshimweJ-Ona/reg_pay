import { IsNotEmpty, IsString } from 'class-validator';

export class RejectTransferDto {
  @IsString()
  @IsNotEmpty()
  rejection_reason: string;
}
