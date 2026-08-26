import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResendVerificationCodeDto {
  @ApiProperty({
    example: 'jean.mugisha1@gmail.com',
    description: 'The email address or phone number associated with the account.',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;
}
