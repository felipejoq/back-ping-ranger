import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly botToken: string;
  private readonly apiBase: string;
  private readonly webhookUrl?: string;
  private polling = false;
  private offset = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN')!;
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
    this.webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL');
  }

  async onApplicationBootstrap() {
    if (this.webhookUrl) {
      await this.setWebhook();
    } else {
      // Remove any existing webhook before starting polling
      await this.deleteWebhook();
      this.polling = true;
      this.logger.log('Telegram bot polling started');
      this.poll();
    }
  }

  onApplicationShutdown() {
    this.polling = false;
    this.logger.log('Telegram bot stopped');
  }

  /** Called by the controller when receiving webhook updates */
  async handleUpdate(update: Record<string, unknown>) {
    // Bot added to group or channel
    if (update.my_chat_member) {
      await this.handleChatMemberUpdate(update.my_chat_member as Record<string, unknown>);
      return;
    }

    // Direct message or group message
    if (update.message) {
      await this.handleMessage(update.message as Record<string, unknown>);
    }
  }

  private async setWebhook() {
    try {
      const url = `${this.webhookUrl}/telegram/webhook`;
      await firstValueFrom(
        this.httpService.post(`${this.apiBase}/setWebhook`, {
          url,
          allowed_updates: ['message', 'my_chat_member'],
        }),
      );
      this.logger.log(`Telegram webhook set to ${url}`);
    } catch (err) {
      this.logger.error(`Failed to set webhook: ${(err as Error).message}`);
      // Fallback to polling
      await this.deleteWebhook();
      this.polling = true;
      this.logger.log('Falling back to polling');
      this.poll();
    }
  }

  private async deleteWebhook() {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.apiBase}/deleteWebhook`),
      );
    } catch {
      // Ignore
    }
  }

  private async poll() {
    while (this.polling) {
      try {
        const res = await firstValueFrom(
          this.httpService.get(`${this.apiBase}/getUpdates`, {
            params: {
              offset: this.offset,
              timeout: 30,
              allowed_updates: JSON.stringify(['message', 'my_chat_member']),
            },
            timeout: 35000,
          }),
        );

        const updates = res.data?.result ?? [];

        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (err) {
        if (this.polling) {
          this.logger.error(`Polling error: ${(err as Error).message}`);
          await this.sleep(5000);
        }
      }
    }
  }

  private async handleMessage(message: Record<string, unknown>) {
    const chat = message.chat as Record<string, unknown>;
    const chatId = chat.id as number;
    const chatType = chat.type as string;
    const text = (message.text as string) ?? '';

    const mentioned = text.toLowerCase().includes('@pingrangerbot');

    if (text.startsWith('/start') || text.startsWith('/chatid') || chatType === 'private' || mentioned) {
      const instructions = this.buildInstructions(chatId, chatType);
      await this.sendMessage(chatId, instructions);
    }
  }

  private async handleChatMemberUpdate(memberUpdate: Record<string, unknown>) {
    const chat = memberUpdate.chat as Record<string, unknown>;
    const chatId = chat.id as number;
    const chatType = chat.type as string;
    const newMember = memberUpdate.new_chat_member as Record<string, unknown>;
    const status = newMember?.status as string;

    if (!['member', 'administrator'].includes(status)) {
      return;
    }

    await this.sleep(1000);
    const instructions = this.buildInstructions(chatId, chatType);
    await this.sendMessage(chatId, instructions);
  }

  private buildInstructions(chatId: number, chatType: string): string {
    const typeLabel =
      chatType === 'private' ? 'mensaje directo'
      : chatType === 'group' || chatType === 'supergroup' ? 'grupo'
      : 'canal';

    return (
      `👋 *¡Hola\\! Soy PingRangerBot*\n\n` +
      `Tu Chat ID para este ${typeLabel} es:\n\n` +
      `\`${chatId}\`\n\n` +
      `Copia este ID y pégalo en el campo *"Chat ID de Telegram"* ` +
      `al configurar las alertas de tu monitor en PingRanger\\.\n\n` +
      (chatType === 'private'
        ? `_Recibirás las alertas como mensaje directo\\._`
        : chatType === 'channel'
          ? `_Asegúrate de que el bot sea administrador del canal con permiso de publicar\\._`
          : `_Asegúrate de que el bot sea miembro del grupo\\._`)
    );
  }

  private async sendMessage(chatId: number, text: string) {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.apiBase}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: 'MarkdownV2',
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to send message to ${chatId}: ${(err as Error).message}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
