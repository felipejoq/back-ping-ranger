import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  exports: [HttpModule],
})
export class AlertsModule {}
