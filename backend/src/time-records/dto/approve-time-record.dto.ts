import { IsOptional, IsString } from 'class-validator';

export class ApproveTimeRecordDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
