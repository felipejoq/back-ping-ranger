import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const monitor = await this.prisma.monitor.findUnique({
      where: { publicSlug: slug, deletedAt: null },
      select: {
        name: true,
        url: true,
        active: true,
        lastStatus: true,
        lastCheckedAt: true,
        lastLatencyMs: true,
        createdAt: true,
        incidents: {
          where: { startedAt: { gte: thirtyDaysAgo } },
          orderBy: { startedAt: 'desc' },
          select: {
            startedAt: true,
            resolvedAt: true,
            statusCode: true,
            errorMsg: true,
          },
        },
      },
    });

    return monitor;
  }
}
