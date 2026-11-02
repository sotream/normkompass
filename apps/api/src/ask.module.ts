import { Module } from '@nestjs/common';
import { ASK_SERVICE, PipelineAskService } from './ask.service.js';
import { AskController } from './ask.controller.js';
import { SEARCH_SERVICE, type SearchPort } from './search.service.js';
import { SearchModule } from './search.module.js';

@Module({
  imports: [SearchModule],
  controllers: [AskController],
  providers: [
    {
      provide: ASK_SERVICE,
      inject: [SEARCH_SERVICE],
      useFactory: (search: SearchPort) => new PipelineAskService(search),
    },
  ],
})
export class AskModule {}
