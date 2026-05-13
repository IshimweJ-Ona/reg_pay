import { IsNotEmpty, IsString } from 'class-validator';

export class RejectUserDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
