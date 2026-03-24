import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AlertChannel, AlertPayload } from '../interfaces/alert-channel.interface';

export class DiscordChannel implements AlertChannel {
  private readonly logger = new Logger(DiscordChannel.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly webhookUrl: string,
  ) {}

  async send(payload: AlertPayload): Promise<void> {
    const embed = payload.status === 'down'
      ? this.buildDownEmbed(payload)
      : this.buildRecoveredEmbed(payload);

    try {
      await firstValueFrom(
        this.httpService.post(this.webhookUrl, {
          username: 'PingRanger',
          embeds: [embed],
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to send Discord alert for ${payload.monitorName}: ${(err as Error).message}`,
      );
    }
  }

  private buildDownEmbed(payload: AlertPayload) {
    const since = payload.incidentStartedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const errorDetail = payload.errorMsg
      ? payload.errorMsg
      : payload.statusCode
        ? `HTTP ${payload.statusCode}`
        : 'Unknown error';

    return {
      title: '🔴 Monitor caído',
      color: 0xef4444,
      fields: [
        { name: 'Nombre', value: payload.monitorName, inline: true },
        { name: 'URL', value: payload.monitorUrl, inline: true },
        { name: 'Desde', value: since, inline: false },
        { name: 'Error', value: errorDetail, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private buildRecoveredEmbed(payload: AlertPayload) {
    const durationMin = payload.resolvedAt
      ? Math.round(
          (payload.resolvedAt.getTime() - payload.incidentStartedAt.getTime()) / 60000,
        )
      : 0;

    return {
      title: '🟢 Monitor recuperado',
      color: 0x22c55e,
      fields: [
        { name: 'Nombre', value: payload.monitorName, inline: true },
        { name: 'URL', value: payload.monitorUrl, inline: true },
        { name: 'Duración del incidente', value: `${durationMin} minutos`, inline: false },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
