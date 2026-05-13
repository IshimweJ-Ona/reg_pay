import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ApproveEmployeeDto {
  @IsString()
  @IsNotEmpty()
  working_location_id: string;

  @IsString()
  @IsNotEmpty()
  department_id: string;

  @IsString()
  @IsNotEmpty()
  employment_category_id: string;

  @IsDateString()
  hire_date: string;
}
