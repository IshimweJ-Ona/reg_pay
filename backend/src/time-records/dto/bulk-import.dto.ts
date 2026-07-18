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
  hours_worked!: number;

  @IsEnum(BulkAttendanceStatus)
  attendance_status!: BulkAttendanceStatus;
}

export class BulkImportDto {
  @IsArray()
  @IsString({ each: true })
  working_location_ids!: string[];

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsDateString()
  attendance_date!: string;

  @IsArray()
  records!: BulkImportItem[];
}