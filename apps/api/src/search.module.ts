import { Module } from '@nestjs/common';
import { SearchController } from './search.controller.js';
import { SEARCH_SERVICE, createSearchService } from './search.service.js';

@Module({
  controllers: [SearchController],
  providers: [{ provide: SEARCH_SERVICE, useFactory: () => createSearchService() }],
  exports: [SEARCH_SERVICE],
})
export class SearchModule {}
