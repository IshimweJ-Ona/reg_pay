import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'The refresh token received from POST /auth/login or the previous ' +
      'POST /auth/refresh call. Each refresh token is single-use — ' +
      'a new one is issued on every successful refresh.',
  })
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
