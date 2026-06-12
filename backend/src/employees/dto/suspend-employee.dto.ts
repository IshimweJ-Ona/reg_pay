import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SuspendEmployeeDto {
  @ApiPropertyOptional({ example: 'Misconduct' })
  @IsOptional()
  @IsString()
  reason?: string;
}
