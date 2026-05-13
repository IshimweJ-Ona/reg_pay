import { DEDUCTION_MODE } from "@prisma/client";
import {
    IsBoolean,
    IsDecimal,
    IsEnum,
    IsOptional,
    IsString,
} from 'class-validator';

export class UpdateDeductionTypeDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(DEDUCTION_MODE)
    deduction_mode?: DEDUCTION_MODE;

    @IsOptional()
    @IsDecimal()
    amount?: string;

    @IsOptional()
    @IsBoolean()
    is_mandatory?: boolean;
}
