import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { BotContext } from '../context.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = TelegrafExecutionContext.create(context).getContext<BotContext>();
    const adminId = parseInt(this.config.getOrThrow('ADMIN_TELEGRAM_ID'), 10);
    return ctx.from?.id === adminId;
  }
}
