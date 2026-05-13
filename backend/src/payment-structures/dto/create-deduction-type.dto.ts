import { DEDUCTION_MODE } from "@prisma/client";
import {
    IsBoolean,
    IsDecimal,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

export class CreateDeductionTypeDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(DEDUCTION_MODE)
    deduction_mode: DEDUCTION_MODE;

    @IsOptional()
    @IsDecimal()
    amount?: string;

    @IsOptional()
    @IsDecimal()
    percentage_value?: string;

    @IsOptional()
    @IsBoolean()
    is_mandatory?: boolean;
}
