import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectTransferDto {
  @ApiProperty({ example: 'Not eligible for transfer' })
  @IsString()
  @IsNotEmpty()
  rejection_reason: string;
}
