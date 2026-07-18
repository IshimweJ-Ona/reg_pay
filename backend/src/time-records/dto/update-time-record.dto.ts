import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from './create-time-record.dto';

export class UpdateTimeRecordDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hours_worked?: number;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendance_status?: AttendanceStatus;
}