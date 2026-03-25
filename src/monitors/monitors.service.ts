import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';

@Injectable()
export class MonitorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.prisma.monitor.findMany({
      where: { userId, deletedAt: null },
      include: {
        incidents: {
          where: { startedAt: { gte: thirtyDaysAgo } },
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateMonitorDto) {
    const { alertConfig, makePublic, ...monitorData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const monitor = await tx.monitor.create({
        data: {
          ...monitorData,
          userId,
          intervalMin: monitorData.intervalMin ?? 5,
          active: monitorData.active ?? true,
          publicSlug: makePublic ? this.generateSlug() : null,
        },
      });

      if (alertConfig) {
        await tx.alertConfig.create({
          data: {
            monitorId: monitor.id,
            type: alertConfig.type,
            config: alertConfig.type === 'telegram'
              ? { chatId: alertConfig.chatId }
              : { webhookUrl: alertConfig.webhookUrl },
          },
        });
      }

      return tx.monitor.findUnique({
        where: { id: monitor.id },
        include: { alertConfig: true },
      });
    });
  }

  async findOne(id: string, userId: string) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id },
      include: {
        incidents: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
        alertConfig: true,
      },
    });

    if (!monitor || monitor.userId !== userId || monitor.deletedAt) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor;
  }

  async update(id: string, userId: string, dto: UpdateMonitorDto) {
    const existing = await this.assertOwnership(id, userId);

    const { alertConfig, makePublic, ...monitorData } = dto;

    let publicSlug: string | null | undefined = undefined;
    if (makePublic === true) {
      publicSlug = existing.publicSlug ?? this.generateSlug();
    } else if (makePublic === false) {
      publicSlug = null;
    }

    return this.prisma.$transaction(async (tx) => {
      const monitor = await tx.monitor.update({
        where: { id },
        data: { ...monitorData, ...(publicSlug !== undefined ? { publicSlug } : {}) },
      });

      if (alertConfig !== undefined) {
        await tx.alertConfig.upsert({
          where: { monitorId: id },
          create: {
            monitorId: id,
            type: alertConfig.type,
            config: alertConfig.type === 'telegram'
              ? { chatId: alertConfig.chatId }
              : { webhookUrl: alertConfig.webhookUrl },
          },
          update: {
            type: alertConfig.type,
            config: alertConfig.type === 'telegram'
              ? { chatId: alertConfig.chatId }
              : { webhookUrl: alertConfig.webhookUrl },
          },
        });
      }

      return tx.monitor.findUnique({
        where: { id: monitor.id },
        include: { alertConfig: true },
      });
    });
  }

  async remove(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    await this.prisma.monitor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertOwnership(id: string, userId: string) {
    const monitor = await this.prisma.monitor.findUnique({ where: { id } });
    if (!monitor || monitor.userId !== userId || monitor.deletedAt) {
      throw new NotFoundException('Monitor not found');
    }
    return monitor;
  }

  private generateSlug(): string {
    return Math.random().toString(36).slice(2, 10);
  }
}
