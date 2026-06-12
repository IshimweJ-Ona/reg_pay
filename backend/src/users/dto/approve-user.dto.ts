import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class ApproveUserDto {
  @ApiPropertyOptional({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'UUID of the working location to assign to the user.',
  })
  @IsOptional()
  @IsString()
  working_location_id: string;

  @ApiPropertyOptional({
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    description: 'UUID of the department to assign to the user.',
  })
  @IsOptional()
  @IsString()
  department_id: string;

  @ApiPropertyOptional({
    example: ['d4e5f6a7-8901-bcde-f123-456789012345'],
    description: 'List of role UUIDs to assign to the user.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  role_ids?: string[];

  @ApiPropertyOptional({
    example: ['e5f6a7b8-9012-cdef-1234-567890123456'],
    description: 'List of specific permission UUIDs to grant to the user.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permission_ids?: string[];
}
