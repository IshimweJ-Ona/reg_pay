import { PartialType } from '@nestjs/swagger';
import { CreateWorkingLocationDto } from './create-working-location.dto';

export class UpdateWorkingLocationDto extends PartialType(CreateWorkingLocationDto) {}