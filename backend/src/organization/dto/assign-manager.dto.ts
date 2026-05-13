import { IsNotEmpty, IsString } from 'class-validator';

export class AssignManagerDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}
