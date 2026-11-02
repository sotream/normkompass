import { Module } from '@nestjs/common';
import { AskModule } from './ask.module.js';
import { HealthModule } from './health.module.js';
import { SearchModule } from './search.module.js';

@Module({ imports: [HealthModule, SearchModule, AskModule] })
export class AppModule {}
