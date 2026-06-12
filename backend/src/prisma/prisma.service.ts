import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopeStorage } from '../common/scope/scope-storage';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _extendedClient: any;

  constructor() {
    super();
    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({
            model,
            operation,
            args,
            query,
          }: {
            model: string;
            operation: string;
            args: any;
            query: any;
          }) {
            const scope = scopeStorage.getStore();
            if (!scope || scope.roles.includes('SUPER_ADMIN')) {
              return query(args);
            }

            const isBM = scope.roles.includes('BRANCH_MANAGER');
            const isScopedRole = ['HR', 'ACCOUNTANT', 'FINANCE'].some((r) =>
              scope.roles.includes(r),
            );

            let a: any = args;
            if (
              (isBM || isScopedRole) &&
              [
                'findMany',
                'findFirst',
                'findUnique',
                'count',
                'aggregate',
                'groupBy',
              ].includes(operation)
            ) {
              a = a ?? {};
              a.where = a.where || {};

              // Models with working_location_id
              const wlModels = [
                'Departments',
                'Users',
                'Employees',
                'Payment_batches',
                'Branch_managers',
                'Time_records',
                'Transactions',
              ];

              if (scope.working_location_id) {
                const wlId = BigInt(scope.working_location_id);
                if (model === 'Working_locations') {
                  a.where.id = wlId;
                } else if (wlModels.includes(model)) {
                  // Time_records and Transactions don't have working_location_id directly,
                  // but we might want to filter them via employee.
                  // For now, let's only filter models that HAVE the field.
                  const modelsWithWlField = [
                    'Departments',
                    'Users',
                    'Employees',
                    'Payment_batches',
                    'Branch_managers',
                  ];
                  if (modelsWithWlField.includes(model)) {
                    a.where.working_location_id = wlId;
                  }
                }
              }

              // Models with department_id
              if (isScopedRole && scope.department_id) {
                const deptId = BigInt(scope.department_id);
                if (model === 'Departments') {
                  a.where.id = deptId;
                } else if (['Users', 'Employees'].includes(model)) {
                  a.where.department_id = deptId;
                }
              }
            }

            return query(a ?? args);
          },
        },
      },
    });

    return this._extendedClient;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
