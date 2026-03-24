import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AlertChannel, AlertPayload } from '../interfaces/alert-channel.interface';

export class SlackChannel implements AlertChannel {
  private readonly logger = new Logger(SlackChannel.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly webhookUrl: string,
  ) {}

  async send(payload: AlertPayload): Promise<void> {
    const blocks = payload.status === 'down'
      ? this.buildDownBlocks(payload)
      : this.buildRecoveredBlocks(payload);

    try {
      await firstValueFrom(
        this.httpService.post(this.webhookUrl, { blocks }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to send Slack alert for ${payload.monitorName}: ${(err as Error).message}`,
      );
    }
  }

  private buildDownBlocks(payload: AlertPayload) {
    const since = payload.incidentStartedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const errorDetail = payload.errorMsg
      ? payload.errorMsg
      : payload.statusCode
        ? `HTTP ${payload.statusCode}`
        : 'Unknown error';

    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔴 Monitor caído', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Nombre:*\n${payload.monitorName}` },
          { type: 'mrkdwn', text: `*URL:*\n${payload.monitorUrl}` },
          { type: 'mrkdwn', text: `*Desde:*\n${since}` },
          { type: 'mrkdwn', text: `*Error:*\n${errorDetail}` },
        ],
      },
    ];
  }

  private buildRecoveredBlocks(payload: AlertPayload) {
    const durationMin = payload.resolvedAt
      ? Math.round(
          (payload.resolvedAt.getTime() - payload.incidentStartedAt.getTime()) / 60000,
        )
      : 0;

    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🟢 Monitor recuperado', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Nombre:*\n${payload.monitorName}` },
          { type: 'mrkdwn', text: `*URL:*\n${payload.monitorUrl}` },
          { type: 'mrkdwn', text: `*Duración:*\n${durationMin} minutos` },
        ],
      },
    ];
  }
}
