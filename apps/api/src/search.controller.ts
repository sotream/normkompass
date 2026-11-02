import { BadRequestException, Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import type { SearchHit } from '@normkompass/search';
import { SEARCH_SERVICE, type SearchPort } from './search.service.js';

export const DEFAULT_LIMIT = 5;
export const MAX_LIMIT = 20;
export const MAX_QUESTION_LENGTH = 1000;

interface SearchBody {
  question?: unknown;
  limit?: unknown;
}

@Controller('search')
export class SearchController {
  constructor(@Inject(SEARCH_SERVICE) private readonly search: SearchPort) {}

  @Post()
  @HttpCode(200)
  async post(@Body() body: SearchBody): Promise<{ results: SearchHit[] }> {
    const { question, limit = DEFAULT_LIMIT } = body;
    if (typeof question !== 'string' || question.trim() === '') {
      throw new BadRequestException('"question" must be a non-empty string');
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(
        `"question" must have at most ${MAX_QUESTION_LENGTH} characters`,
      );
    }
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(`"limit" must be an integer between 1 and ${MAX_LIMIT}`);
    }
    return { results: await this.search.search(question.trim(), limit) };
  }
}
