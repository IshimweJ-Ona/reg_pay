import { GENDER } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsArray,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'Jean',
    description: 'First name of the registering user.',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    example: 'Mugisha',
    description: 'Last name of the registering user.',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    example: 'jean.mugisha1@gmail.com',
    description: 'Must be a valid @gmail.com or @reg.rw address.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com)$/, {
    message: 'Email must be a valid @gmail.com or @reg.com address.',
  })
  email: string;

  @ApiProperty({
    example: '+250788628835',
    description:
      'Valid Rwanda mobile number. Accepted prefixes: +25072, +25073, +25078, +25079.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+2507[2389][0-9]{7}$/, {
    message: 'Phone number must be a valid Rwanda number (+2507...).',
  })
  phone_number: string;

  @ApiProperty({
    example: 'MyP@ssw0rd1!',
    description:
      'Password must be at least 5 characters and contain: one uppercase letter, ' +
      'one lowercase letter, two digits, and one special character (@$!%*?&).',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    enum: GENDER,
    example: GENDER.MALE,
    description: 'Gender of the registering user.',
  })
  @IsEnum(GENDER)
  gender: GENDER;

  @ApiPropertyOptional({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'UUID of the department within the chosen working location.',
  })
  @IsOptional()
  @IsString()
  department_id?: string;

  @ApiPropertyOptional({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description:
      'UUID of the working location (branch) the user is registering into. ' +
      'When provided, the local Branch Manager receives the approval notification.',
  })
  @IsOptional()
  @IsString()
  working_location_id?: string;

  @ApiPropertyOptional({
    example: ['b2c3d4e5-f6a7-8901-bcde-f12345678901'],
    description: 'List of role UUIDs to assign to the user upon approval.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  role_ids?: string[];

  @ApiPropertyOptional({
    example: ['d4e5f6a7-8901-bcde-f123-456789012345'],
    description: 'List of specific permission UUIDs to grant to the user.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permission_ids?: string[];
}
