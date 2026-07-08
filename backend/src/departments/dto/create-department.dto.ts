import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
    
    @ApiProperty({
        example: 'FIN-01',
        maxLength: 20,
        description: 'Unique code for the department.',
    })
    
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    code: string;
    
    @ApiProperty({
        example: 'Finance Department',
        maxLength: 100,
        description: 'Full name of the department.',
    })
    
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;
    
    @ApiPropertyOptional({
        example: 'Responsible for all financial operations and payroll accounting.',
        description: "Detailed description of the department's role.",
    })
    @IsOptional()
    @IsString()
    description?: string;
}
