import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { MonitorsModule } from './monitors/monitors.module';
import { IncidentsModule } from './incidents/incidents.module';
import { AlertsModule } from './alerts/alerts.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TelegramBotModule } from './telegram-bot/telegram-bot.module';
import { EventsModule } from './events/events.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        FRONTEND_URL: Joi.string().required(),
        BETTER_AUTH_SECRET: Joi.string().required(),
        GITHUB_CLIENT_ID: Joi.string().required(),
        GITHUB_CLIENT_SECRET: Joi.string().required(),
        TELEGRAM_BOT_TOKEN: Joi.string().required(),
        TELEGRAM_WEBHOOK_URL: Joi.string().optional(),
        BACKEND_URL: Joi.string().optional(),
        PORT: Joi.number().default(3000),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MonitorsModule,
    IncidentsModule,
    AlertsModule,
    SchedulerModule,
    TelegramBotModule,
    EventsModule,
    PublicModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
