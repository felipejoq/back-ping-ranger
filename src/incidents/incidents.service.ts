import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    monitorId: string,
    limit = 20,
    offset = 0,
  ) {
    const monitor = await this.prisma.monitor.findUnique({
      where: { id: monitorId },
    });

    if (!monitor || monitor.userId !== userId) {
      throw new NotFoundException('Monitor not found');
    }

    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where: { monitorId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.incident.count({ where: { monitorId } }),
    ]);

    return { incidents, total, limit, offset };
  }
}
