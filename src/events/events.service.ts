import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface MonitorEvent {
  type: 'monitor_updated' | 'monitor_created' | 'monitor_deleted' | 'check_completed';
  monitorId: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  private readonly subjects = new Map<string, Subject<MonitorEvent>>();

  subscribe(userId: string): Observable<MonitorEvent> {
    if (!this.subjects.has(userId)) {
      this.subjects.set(userId, new Subject<MonitorEvent>());
    }
    return this.subjects.get(userId)!.asObservable();
  }

  emit(userId: string, event: MonitorEvent) {
    const subject = this.subjects.get(userId);
    if (subject) {
      subject.next(event);
    }
  }

  removeClient(userId: string) {
    const subject = this.subjects.get(userId);
    if (subject && !subject.observed) {
      this.subjects.delete(userId);
    }
  }
}
