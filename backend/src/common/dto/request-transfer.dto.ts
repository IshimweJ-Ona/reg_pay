import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestTransferDto {
  @ApiProperty({ example: 'loc-uuid' })
  @IsString()
  @IsNotEmpty()
  working_location_id!: string;

  @ApiPropertyOptional({ example: 'dept-uuid' })
  @IsOptional()
  @IsString()
  department_id!: string;

  @ApiPropertyOptional({
    example: 'Rejected transfer emplyee has been suspended',
  })
  @IsOptional()
  @IsString()
  reason!: string;
}
