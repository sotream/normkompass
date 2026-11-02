import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigurationError, type AnswerResponse } from '@normkompass/answer';
import { ASK_SERVICE, type AskPort } from './ask.service.js';
import { MAX_QUESTION_LENGTH } from './search.controller.js';

interface AskBody {
  question?: unknown;
}

@Controller('ask')
export class AskController {
  constructor(@Inject(ASK_SERVICE) private readonly service: AskPort) {}

  @Post()
  @HttpCode(200)
  async post(@Body() body: AskBody): Promise<AnswerResponse> {
    const { question } = body;
    if (typeof question !== 'string' || question.trim() === '') {
      throw new BadRequestException('"question" must be a non-empty string');
    }
    if (question.length > MAX_QUESTION_LENGTH) {
      throw new BadRequestException(
        `"question" must have at most ${MAX_QUESTION_LENGTH} characters`,
      );
    }
    try {
      return await this.service.ask(question.trim());
    } catch (error) {
      if (error instanceof ConfigurationError) throw new ServiceUnavailableException(error.message);
      throw error;
    }
  }
}
