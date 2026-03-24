import { Controller, Get, Query, Req } from '@nestjs/common';
import { IncidentsService } from './incidents.service';

interface AuthRequest {
  auth: { userId: string };
}

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(
    @Req() req: AuthRequest,
    @Query('monitorId') monitorId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.incidentsService.findAll(
      req.auth.userId,
      monitorId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
