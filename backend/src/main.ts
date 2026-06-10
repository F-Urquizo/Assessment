import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // whitelist + forbidNonWhitelisted reject unknown fields; transform coerces
  // plain objects into DTO class instances. 422 matches the API contract.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
