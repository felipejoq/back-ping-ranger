import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';
import { EventsService } from '../events/events.service';
import { SchedulerService } from '../scheduler/scheduler.service';

interface AuthRequest {
  auth: { userId: string };
}

@Controller('monitors')
export class MonitorsController {
  constructor(
    private readonly monitorsService: MonitorsService,
    private readonly eventsService: EventsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Get()
  findAll(@Req() req: AuthRequest) {
    return this.monitorsService.findAll(req.auth.userId);
  }

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateMonitorDto) {
    const monitor = await this.monitorsService.create(req.auth.userId, dto);
    this.eventsService.emit(req.auth.userId, {
      type: 'monitor_created',
      monitorId: monitor!.id,
    });
    return monitor;
  }

  @Get(':id')
  findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.monitorsService.findOne(id, req.auth.userId);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    const monitor = await this.monitorsService.update(id, req.auth.userId, dto);
    this.eventsService.emit(req.auth.userId, {
      type: 'monitor_updated',
      monitorId: id,
    });
    return monitor;
  }

  @Post(':id/check')
  @HttpCode(HttpStatus.NO_CONTENT)
  async checkNow(@Req() req: AuthRequest, @Param('id') id: string) {
    const monitor = await this.monitorsService.findOne(id, req.auth.userId);
    await this.schedulerService.checkMonitor(monitor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.monitorsService.remove(id, req.auth.userId);
    this.eventsService.emit(req.auth.userId, {
      type: 'monitor_deleted',
      monitorId: id,
    });
  }
}
