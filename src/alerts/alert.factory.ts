import { HttpService } from '@nestjs/axios';
import { AlertChannel } from './interfaces/alert-channel.interface';
import { TelegramChannel } from './channels/telegram.channel';
import { DiscordChannel } from './channels/discord.channel';
import { SlackChannel } from './channels/slack.channel';

interface AlertFactoryOptions {
  type: string;
  config: Record<string, unknown>;
  botToken: string;
  httpService: HttpService;
}

export class AlertFactory {
  static create(options: AlertFactoryOptions): AlertChannel {
    const { type, config, botToken, httpService } = options;
    switch (type) {
      case 'telegram':
        return new TelegramChannel(httpService, botToken, config.chatId as string);
      case 'discord':
        return new DiscordChannel(httpService, config.webhookUrl as string);
      case 'slack':
        return new SlackChannel(httpService, config.webhookUrl as string);
      default:
        throw new Error(`Unsupported alert channel type: ${type}`);
    }
  }
}
