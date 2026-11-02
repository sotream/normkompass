import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
if (existsSync('.env'))
    process.loadEnvFile('.env');
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
