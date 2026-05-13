import {
    IsBoolean,
    IsDateString,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreateEmployeeDeductionDto {
    @IsString()
    @IsNotEmpty()
    employee_id: string;

    @IsString()
    @IsNotEmpty()
    deduction_type_id: string;

    @IsDateString()
    start_date: string;

    @IsOptional()
    @IsDateString()
    end_date?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
