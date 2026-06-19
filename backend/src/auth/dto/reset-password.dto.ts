import { ApiProperty as ApiProp4 } from '@nestjs/swagger';
import {
  IsNotEmpty as NotEmpty4,
  IsString as Str4,
  Matches as Match4,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProp4({
    example: 'MyNewP@ssw0rd1!',
    description:
      'New password. Must be at least 5 characters and contain: ' +
      'one uppercase letter, one lowercase letter, two digits, ' +
      'and one special character (@$!%*?&).',
  })
  @Str4()
  @NotEmpty4()
  @Match4(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{5,}$/,
    {
      message:
        'Password must be at least 5 characters with one uppercase, one lowercase, ' +
        'two digits, and one special character (@$!%*?&).',
    },
  )
  password!: string;

  @ApiProp4({
    example: 'MyNewP@ssw0rd1!',
    description: 'Must exactly match the password field.',
  })
  @Str4()
  @NotEmpty4()
  confirmPassword!: string;
}
