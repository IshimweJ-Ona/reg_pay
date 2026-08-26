import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { working_locations_type } from '@prisma/client';

export class CreateWorkingLocationDto {
  @ApiProperty({ example: 'Kigali HQ', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  // Short branch code (e.g. "HQ", "HUY") shown alongside department names so
  // a cross-branch viewer can tell apart same-named departments in different
  // branches. Auto-derived from the name when omitted - see
  // OrganizationService.generateLocationCode().
  @ApiPropertyOptional({ example: 'HUY', maxLength: 12 })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'code must be uppercase letters/numbers only.',
  })
  code?: string;

  @ApiProperty({ enum: working_locations_type })
  @IsEnum(working_locations_type)
  type: working_locations_type;

  @ApiProperty({ example: 'KG 7 Ave, Kigali', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;
}
