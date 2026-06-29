import { ATTENDANCE_STATUS } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTimeRecordDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hours_worked?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  overtime_hours?: number;

  @IsOptional()
  @IsEnum(ATTENDANCE_STATUS)
  attendance_status?: ATTENDANCE_STATUS;
}
