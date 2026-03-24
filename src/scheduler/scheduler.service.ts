import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AlertFactory } from '../alerts/alert.factory';
import { AlertPayload } from '../alerts/interfaces/alert-channel.interface';
import { EventsService } from '../events/events.service';
import { Monitor } from '../generated/prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly eventsService: EventsService,
  ) {}

  @Cron('* * * * *')
  async runChecks() {
    const now = new Date();

    const monitors = await this.prisma.monitor.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [
          { lastCheckedAt: null },
          {
            lastCheckedAt: {
              lte: new Date(now.getTime() - 60000), // will filter per-monitor below
            },
          },
        ],
      },
    });

    // Filter monitors where it's actually time to check based on intervalMin
    const due = monitors.filter((m) => {
      if (!m.lastCheckedAt) return true;
      const msSinceCheck = now.getTime() - m.lastCheckedAt.getTime();
      return msSinceCheck >= m.intervalMin * 60 * 1000;
    });

    await Promise.allSettled(due.map((m) => this.checkMonitor(m)));
  }

  async checkMonitor(monitor: Monitor) {
    const start = Date.now();

    let isUp = false;
    let statusCode: number | undefined;
    let errorMsg: string | undefined;

    try {
      const response = await firstValueFrom(
        this.httpService.get(monitor.url, { timeout: 10000 }),
      );
      statusCode = response.status;
      isUp = response.status < 400;
    } catch (err: unknown) {
      isUp = false;
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number }; message?: string };
        statusCode = axiosErr.response?.status;
        errorMsg = axiosErr.message;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
    }

    const latencyMs = Date.now() - start;

    await this.prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        lastCheckedAt: new Date(),
        lastStatus: isUp ? 'up' : 'down',
        lastLatencyMs: latencyMs,
      },
    });

    const activeIncident = await this.prisma.incident.findFirst({
      where: { monitorId: monitor.id, resolvedAt: null },
    });

    const alertConfig = await this.prisma.alertConfig.findUnique({
      where: { monitorId: monitor.id },
    });

    if (!isUp && !activeIncident) {
      const incident = await this.prisma.incident.create({
        data: {
          monitorId: monitor.id,
          statusCode,
          errorMsg,
        },
      });

      if (alertConfig) {
        try {
          const payload: AlertPayload = {
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            status: 'down',
            incidentStartedAt: incident.startedAt,
            statusCode,
            errorMsg,
          };
          const channel = AlertFactory.create({
            type: alertConfig.type,
            config: alertConfig.config as Record<string, unknown>,
            botToken: this.configService.get<string>('TELEGRAM_BOT_TOKEN')!,
            httpService: this.httpService,
          });
          await channel.send(payload);
        } catch (err) {
          this.logger.error(`Alert send failed for ${monitor.url}: ${(err as Error).message}`);
        }
      }
    } else if (isUp && activeIncident) {
      const resolvedAt = new Date();
      await this.prisma.incident.update({
        where: { id: activeIncident.id },
        data: { resolvedAt },
      });

      if (alertConfig) {
        try {
          const payload: AlertPayload = {
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            status: 'recovered',
            incidentStartedAt: activeIncident.startedAt,
            resolvedAt,
          };
          const channel = AlertFactory.create({
            type: alertConfig.type,
            config: alertConfig.config as Record<string, unknown>,
            botToken: this.configService.get<string>('TELEGRAM_BOT_TOKEN')!,
            httpService: this.httpService,
          });
          await channel.send(payload);
        } catch (err) {
          this.logger.error(`Alert send failed for ${monitor.url}: ${(err as Error).message}`);
        }
      }
    }

    // Emit SSE event to connected clients
    this.eventsService.emit(monitor.clerkUserId, {
      type: 'check_completed',
      monitorId: monitor.id,
      data: {
        status: isUp ? 'up' : 'down',
        latencyMs,
        lastCheckedAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `[Scheduler] ${monitor.url} → ${isUp ? 'up' : 'down'} ${latencyMs}ms`,
    );
  }
}
