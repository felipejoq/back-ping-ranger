import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [HttpModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
