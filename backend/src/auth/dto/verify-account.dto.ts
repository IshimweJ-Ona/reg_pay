import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyAccountDto {
  @ApiProperty({
    example: 'jean.mugisha1@gmail.com',
    description: 'The email address or phone number associated with the account.',
  })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({
    example: '482913',
    description: 'The 6-digit verification code emailed after account approval.',
  })
  @IsString()
  @Length(6, 6)
  code!: string;
}
