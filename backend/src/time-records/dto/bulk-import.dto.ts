import { ATTENDANCE_STATUS } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkImportRecordDto {
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @IsDateString()
  attendance_date: string;

  @IsEnum(ATTENDANCE_STATUS)
  attendance_status: 'PRESENT' | 'ABSENT';

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
}

export class BulkImportDto {
  @IsDateString()
  date_from: string;

  @IsDateString()
  date_to: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportRecordDto)
  records: BulkImportRecordDto[];
}
