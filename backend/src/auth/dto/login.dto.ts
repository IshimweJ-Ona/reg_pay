import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'jean.mugisha1@gmail.com',
    description:
      'Email address or Rwanda phone number (+2507...) registered on the system.',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    example: 'MyP@ssw0rd1!',
    description: 'Account password.',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
