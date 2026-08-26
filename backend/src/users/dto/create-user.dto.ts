import { OmitType } from '@nestjs/swagger';
import { RegisterDto } from '../../auth/dto/register.dto';

export class CreateUserDto extends OmitType(RegisterDto, [
  'password',
] as const) {}
