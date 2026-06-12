import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApprovePayrollItemDto {
  @ApiPropertyOptional({
    example: 'Verified and approved for payment.',
    description: 'Optional comment explaining the approval.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
