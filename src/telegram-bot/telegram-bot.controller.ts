import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram')
export class TelegramBotController {
  constructor(private readonly botService: TelegramBotService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() update: Record<string, unknown>) {
    await this.botService.handleUpdate(update);
    return { ok: true };
  }
}
