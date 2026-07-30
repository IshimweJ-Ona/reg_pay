import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum BulkAttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export class BulkImportItem {
  @IsString()
  employee_id!: string;

  @IsDateString()
  attendance_date!: string;

  @IsNumber()
  @Min(0)
  overtime_hours!: number;

  @IsEnum(BulkAttendanceStatus)
  attendance_status!: BulkAttendanceStatus;
}

export class BulkImportDto {
  @IsOptional()
  @IsString()
  working_location?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsDateString()
  attendance_date?: string;

  @IsArray()
  records!: BulkImportItem[];
}
