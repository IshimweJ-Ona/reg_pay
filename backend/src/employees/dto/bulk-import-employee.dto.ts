import {
  IsArray,
  IsOptional,
  IsString,
  IsIn,
  Matches,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  REG_EMAIL_MESSAGE,
  REG_EMAIL_REGEX,
  RWANDA_NATIONAL_ID_MESSAGE,
  RWANDA_NATIONAL_ID_REGEX,
  RWANDA_PHONE_MESSAGE,
  RWANDA_PHONE_REGEX,
} from '../../common/constants/validation.constants';

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
  @Matches(REG_EMAIL_REGEX, { message: REG_EMAIL_MESSAGE })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(RWANDA_PHONE_REGEX, { message: RWANDA_PHONE_MESSAGE })
  phone_number?: string;

  @IsOptional()
  @IsString()
  @Matches(RWANDA_NATIONAL_ID_REGEX, { message: RWANDA_NATIONAL_ID_MESSAGE })
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
  position_id?: string;

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
