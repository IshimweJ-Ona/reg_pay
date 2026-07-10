import { IsArray, IsOptional, IsString, IsIn, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkImportEmployeeItem {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  last_name!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  national_id?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MALE', 'FEMALE'])
  gender?: string;

  @IsOptional()
  @IsString()
  contract_start_date?: string;

  @IsOptional()
  @IsString()
  contract_end_date?: string;

  @IsOptional()
  @IsString()
  department_id?: string;

  @IsOptional()
  @IsString()
  working_location_id?: string;

  @IsOptional()
  @IsString()
  employment_category_id?: string;

  @IsOptional()
  @IsString()
  basic_salary?: string;

  @IsOptional()
  @IsString()
  daily_rate?: string;

  @IsOptional()
  @IsString()
  tax_percentage?: string;
}

export class BulkImportEmployeeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportEmployeeItem)
  employees!: BulkImportEmployeeItem[];
}
