import { ATTENDANCE_STATUS } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTimeRecordDto {
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @IsDateString()
  attendance_date: string;

  @IsOptional()
  @IsDateString()
  clock_in?: string;

  @IsOptional()
  @IsEnum(ATTENDANCE_STATUS)
  attendance_status?: ATTENDANCE_STATUS;
}
