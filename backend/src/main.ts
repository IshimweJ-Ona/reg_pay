import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import { AllExceptionsFilter } from './common/utils/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalInterceptors(new BigIntInterceptor());

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = (
        process.env.CORS_ORIGINS ??
        'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5000,http://127.0.0.1:5000'
      )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      // Check if the origin is allowed or if it's a localhost origin
      const isAllowed = allowedOrigins.some((allowed) =>
        origin.startsWith(allowed),
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        console.error(`CORS blocked for origin: ${origin}`);
        callback(new Error('Origin is not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
  });

  // Configure global pipes for validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Start the server and log the access URL
  const port = Number(process.env.PORT ?? 5000);

  const SwaggerConfig = new DocumentBuilder()
    .setTitle('REG-PAY API')
    .setDescription(
      [
        'REG-PAY payroll and employee management API for REG (Rwanda Energy Group).',
        '',
        '## Authentication',
        '1. Call `POST /auth/login` with an email/phone + password to get an `access_token` (15 min) and `refresh_token` (7 days).',
        '2. Click **Authorize** below and paste the `access_token` (no `Bearer ` prefix needed - Swagger adds it).',
        '3. Call `POST /auth/refresh` with the `refresh_token` before the access token expires to get a new pair.',
        '',
        '## Access control',
        'Most endpoints require specific permission keys (see the RBAC module) or a role. `SUPER_ADMIN` bypasses all permission and branch-scoping checks. Endpoints marked (public) in their summary are public.',
        '',
        '## Branch scoping',
        "Unless a request is made by `SUPER_ADMIN` or a user holding the relevant `<module>.read_all` permission, list/read endpoints are automatically filtered to the caller's own `working_location_id`.",
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .addTag('Auth', 'Login, registration, sessions, password reset')
    .addTag('Users', 'Staff account management, approvals, transfers')
    .addTag('RBAC', 'Roles and permission assignment')
    .addTag(
      'Organization',
      'Working locations (branches/HQ) and branch managers',
    )
    .addTag('Departments', 'Departments within a working location')
    .addTag('Employees', 'Employee records, contracts, transfers')
    .addTag('Attendance', 'Daily time records and bulk attendance import')
    .addTag(
      'Payment Structures',
      'Pay rates, allowances, deductions, PAYE preview',
    )
    .addTag('Payroll', 'Payroll batches, calculation, approval, export')
    .addTag('Ikimina', 'Employee savings group memberships and contributions')
    .addTag('Notifications', 'In-app notifications and live updates')
    .addTag('Audit Logs', 'System activity trail')
    .addTag(
      'System Config',
      'Global settings such as overtime rate and tax defaults',
    )
    .addTag('App', 'Health/status')
    .build();
  const document = SwaggerModule.createDocument(app, SwaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  console.log(`\nBackend is running on: http://localhost:${port}\n`);
}
bootstrap().catch((err) => {
  console.error('Error during bootstrap:', err);
  process.exit(1);
});
