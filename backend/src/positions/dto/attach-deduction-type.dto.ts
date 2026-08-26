import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AttachDeductionTypeDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID (or id) of the deduction type to attach as a default for this position.',
  })
  @IsString()
  @IsNotEmpty()
  deduction_type_id: string;
}
