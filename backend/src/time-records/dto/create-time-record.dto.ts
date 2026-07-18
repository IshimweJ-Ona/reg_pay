import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export class CreateTimeRecordDto {
  @IsString()
  @IsNotEmpty()
  employee_id!: string;

  @IsDateString()
  attendance_date!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hours_worked?: number;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendance_status?: AttendanceStatus;
}