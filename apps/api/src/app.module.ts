import { Module } from '@nestjs/common';
import { HealthModule } from './health.module.js';
import { SearchModule } from './search.module.js';

@Module({ imports: [HealthModule, SearchModule] })
export class AppModule {}
