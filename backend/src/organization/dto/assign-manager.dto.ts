import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignManagerDto {
  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'The UUID of the user to be assigned as manager.',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;
}
