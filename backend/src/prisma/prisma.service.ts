import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { scopeStorage } from '../common/scope/scope-storage';
import { MODULE_SCOPE_CONFIG } from '../common/constants/permissions.constants';

const SCOPED_READ_OPERATIONS = [
  'findMany',
  'findFirst',
  'findUnique',
  'count',
  'aggregate',
  'groupBy',
];

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

            // No authenticated request context (e.g. a script/seed run
            // outside an HTTP request), or SUPER_ADMIN: no scoping applied.
            if (!scope || scope.roles.includes('SUPER_ADMIN')) {
              return query(args);
            }

            const config = MODULE_SCOPE_CONFIG[model];
            if (!config || !SCOPED_READ_OPERATIONS.includes(operation)) {
              return query(args);
            }

            // Holding the module's "<module>.read_all" permission lifts the
            // working_location filter entirely for this model — this is
            // what makes a role "regional" vs "global" for that specific
            // module, driven by permissions rather than a hardcoded role
            // name. Every scoped model goes through this same check, so
            // adding a new scoped model is a one-line registry entry
            // (MODULE_SCOPE_CONFIG) instead of a new hardcoded branch here.
            const hasReadAll = scope.permissions.includes(
              config.readAllPermission,
            );

            if (hasReadAll || !config.locationField || !scope.working_location_id) {
              return query(args);
            }

            const a: any = args ?? {};
            a.where = a.where || {};

            const wlId = BigInt(scope.working_location_id);
            if (model === 'Working_locations') {
              a.where.id = wlId;
            } else {
              a.where[config.locationField] = wlId;
            }

            return query(a);
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
