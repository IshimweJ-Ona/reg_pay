import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.useGlobalInterceptors(new BigIntInterceptor());

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = (
        process.env.CORS_ORIGINS ??
        'http://localhost:3000,http://127.0.0.1:3000'
      )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
  await app.listen(port);
  console.log(`\nBackend is running on: http://localhost:${port}\n`);
}
bootstrap();
