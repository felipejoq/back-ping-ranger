import { Controller, Sse, Req, UseGuards, MessageEvent, Logger } from '@nestjs/common';
import { Observable, map, startWith, finalize } from 'rxjs';
import { Public } from '../auth/public.decorator';
import { SseAuthGuard } from './sse-auth.guard';
import { EventsService } from './events.service';

interface AuthRequest {
  auth: { userId: string };
}

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @UseGuards(SseAuthGuard)
  @Sse('monitors')
  monitors(@Req() req: AuthRequest): Observable<MessageEvent> {
    const userId = req.auth.userId;
    this.logger.log(`SSE client connected: ${userId}`);

    return this.eventsService.subscribe(userId).pipe(
      startWith({ type: 'connected' as const, monitorId: '', data: {} }),
      map((event) => ({
        data: {
          type: event.type,
          monitorId: event.monitorId,
          ...event.data,
        },
      })),
      finalize(() => {
        this.logger.log(`SSE client disconnected: ${userId}`);
        this.eventsService.removeClient(userId);
      }),
    );
  }
}
