import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [PositionsController],
  providers: [PositionsService],
  exports: [PositionsService],
})
export class PositionsModule {}

export interface SerializedPositionEmploymentCategory {
  uuid: string;
  employment_category_id: string;
  name: string;
  payroll_frequency: string;
  tax_behavior: string;
  default_basic_salary: string | null;
  default_daily_rate: string | null;
  default_overtime_rate: string | null;
  default_custom_work_days: number | null;
}

export interface SerializedPosition {
  id: string;
  uuid: string;
  name: string;
  description: string | null;
  status: string;
  // A position can have several employment-category variants (Monthly /
  // Daily / Custom), each with its own default salary - so assigning an
  // employee requires picking both this position AND one of these variants.
  employment_categories: SerializedPositionEmploymentCategory[];
  deduction_types: {
    uuid: string;
    name: string;
    deduction_mode: string;
  }[];
  allowance_templates: {
    uuid: string;
    title: string;
    default_amount: string;
    description: string | null;
    allowance_type_id: string | null;
  }[];
  created_at: Date;
  updated_at: Date;
}

export function serializePosition(
  position: Record<string, any>,
): SerializedPosition {
  const employmentCategoryVariants = Array.isArray(
    position.position_employment_categories,
  )
    ? position.position_employment_categories
    : [];
  const deductionTypes = Array.isArray(position.position_deduction_types)
    ? position.position_deduction_types
    : [];
  const allowanceTemplates = Array.isArray(position.position_allowance_templates)
    ? position.position_allowance_templates
    : [];

  return {
    id: position.id.toString(),
    uuid: position.uuid,
    name: position.name,
    description: position.description ?? null,
    status: position.status,
    employment_categories: employmentCategoryVariants.map((variant: any) => ({
      uuid: variant.uuid,
      employment_category_id: variant.employment_category_id.toString(),
      name: variant.employment_categories.name,
      payroll_frequency: variant.employment_categories.payroll_frequency,
      tax_behavior: variant.employment_categories.tax_behavior,
      default_basic_salary: variant.default_basic_salary?.toString() ?? null,
      default_daily_rate: variant.default_daily_rate?.toString() ?? null,
      default_overtime_rate: variant.default_overtime_rate?.toString() ?? null,
      default_custom_work_days: variant.default_custom_work_days ?? null,
    })),
    deduction_types: deductionTypes.map((entry: any) => ({
      uuid: entry.deduction_types.uuid,
      name: entry.deduction_types.name,
      deduction_mode: entry.deduction_types.deduction_mode,
    })),
    allowance_templates: allowanceTemplates.map((template: any) => ({
      uuid: template.uuid,
      title: template.title,
      default_amount: template.default_amount?.toString() ?? '0',
      description: template.description ?? null,
      allowance_type_id: template.allowance_type_id?.toString() ?? null,
    })),
    created_at: position.created_at,
    updated_at: position.updated_at,
  };
}
