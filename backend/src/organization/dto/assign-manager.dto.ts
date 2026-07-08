import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignManagerDto {
  @ApiProperty({ example: 'uuid-or-numeric-id-of-the-user' })
  @IsString()
  @IsNotEmpty()
  user_id: string;
}