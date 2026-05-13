import { ATTENDANCE_STATUS } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdateTimeRecordDto {
  @IsOptional()
  @IsDateString()
  clock_out?: string;

  @IsOptional()
  @IsEnum(ATTENDANCE_STATUS)
  attendance_status?: ATTENDANCE_STATUS;
}
