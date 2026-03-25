import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AlertChannel, AlertPayload } from '../interfaces/alert-channel.interface';

export class TelegramChannel implements AlertChannel {
  private readonly logger = new Logger(TelegramChannel.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  async send(payload: AlertPayload): Promise<void> {
    const text = payload.status === 'down'
      ? this.buildDownMessage(payload)
      : this.buildRecoveredMessage(payload);

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      this.logger.log(`Sending to chat_id: "${this.chatId}", bot token ends with: ...${this.botToken.slice(-6)}`);
      await firstValueFrom(
        this.httpService.post(url, {
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
        }),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: unknown }; message?: string };
      this.logger.error(
        `Failed to send Telegram alert for ${payload.monitorName}: ${axiosErr.message}`,
      );
      if (axiosErr.response?.data) {
        this.logger.error(`Telegram API response: ${JSON.stringify(axiosErr.response.data)}`);
      }
    }
  }

  private buildDownMessage(payload: AlertPayload): string {
    const since = payload.incidentStartedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const errorDetail = payload.errorMsg
      ? payload.errorMsg
      : payload.statusCode
        ? `HTTP ${payload.statusCode}`
        : 'Unknown error';

    return (
      `🔴 <b>Monitor caído</b>\n` +
      `<b>Nombre:</b> ${payload.monitorName}\n` +
      `<b>URL:</b> ${payload.monitorUrl}\n` +
      `<b>Desde:</b> ${since}\n` +
      `<b>Error:</b> ${errorDetail}`
    );
  }

  private buildRecoveredMessage(payload: AlertPayload): string {
    const durationMin = payload.resolvedAt
      ? Math.round(
          (payload.resolvedAt.getTime() - payload.incidentStartedAt.getTime()) / 60000,
        )
      : 0;

    return (
      `🟢 <b>Monitor recuperado</b>\n` +
      `<b>Nombre:</b> ${payload.monitorName}\n` +
      `<b>URL:</b> ${payload.monitorUrl}\n` +
      `<b>Duración del incidente:</b> ${durationMin} minutos`
    );
  }
}
