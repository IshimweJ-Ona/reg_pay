import { IsNotEmpty, IsString } from 'class-validator';

export class AssignUserAccountDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}
