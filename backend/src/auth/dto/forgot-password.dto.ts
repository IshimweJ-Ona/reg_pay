import { ApiProperty as ApiProp3 } from '@nestjs/swagger';
import { IsNotEmpty as NotEmpty3, IsString as Str3 } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProp3({
    example: 'jean.mugisha1@gmail.com',
    description:
      'The email address or Rwanda phone number (+2507...) associated with the account. ' +
      'If no matching account is found the response is identical to a successful request ' +
      '(security measure to prevent user enumeration).',
  })
  @Str3()
  @NotEmpty3()
  identifier: string;
}
