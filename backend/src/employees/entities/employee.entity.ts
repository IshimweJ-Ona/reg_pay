import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Represents the shape of an employee returned by every endpoint in the employees.controller.

export class EmployeeEntity {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  uuid?: string;

  @ApiProperty({ example: 'Jean' })
  first_name?: string;

  @ApiProperty({ example: 'Mugisha' })
  last_name?: string;

  @ApiPropertyOptional({ example: 'jean.mugisha1@gmail.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+250788123456' })
  phone_number?: string | null;

  @ApiPropertyOptional({ example: '1199012345678901' })
  national_id?: string | null;

  @ApiProperty({ enum: ['MALE', 'FEMALE'], example: 'MALE' })
  gender?: string;

  @ApiPropertyOptional({ example: '2022-01-15', type: String, format: 'date' })
  hire_date?: string | null;

  @ApiProperty({
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED'],
    example: 'ACTIVE',
  })
  status?: string;

  @ApiPropertyOptional({
    example: 'https://randomuser.me/api/portraits/men/1.jpg',
  })
  avatar_url?: string | null;

  @ApiPropertyOptional({ description: 'Department the employee belongs to' })
  department?: {
    uuid: string;
    name: string;
    code: string;
  } | null;

  @ApiPropertyOptional({ description: 'Working location / branch' })
  working_location?: {
    uuid: string;
    name: string;
    type: string;
  } | null;

  @ApiPropertyOptional({
    description: 'Employment category (Monthly / Daily / Custom)',
  })
  employment_category?: {
    uuid: string;
    name: string;
    payroll_frequency: string;
  } | null;

  @ApiProperty({ example: '2024-01-10T08:00:00.000Z' })
  created_at?: Date;

  @ApiProperty({ example: '2024-06-01T10:30:00.000Z' })
  updated_at?: Date;
}

// Paginated wrapper used by GET /employees
export class PaginatedEmployeesEntity {
  @ApiProperty({ type: [EmployeeEntity] })
  data?: EmployeeEntity[];

  @ApiProperty({ example: 400 })
  total?: number;
}

// Transfer request snapshot returned after initiating a transfer
export class TransferRequestEntity {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  uuid?: string;

  @ApiProperty({ enum: ['EMPLOYEE', 'USER'], example: 'EMPLOYEE' })
  subject_type?: string;

  @ApiProperty({
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    example: 'PENDING',
  })
  status?: string;

  @ApiPropertyOptional({ example: 'Operational needs in Nothern Province' })
  reason?: string | null;

  @ApiProperty({ description: 'Target working location UUID' })
  new_working_location_id?: string;

  @ApiProperty({ description: 'Target department UUID' })
  new_department_id?: string;

  @ApiProperty({ example: '2024-06-01T10:30:00.000Z' })
  requested_at?: Date;
}
