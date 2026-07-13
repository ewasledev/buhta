import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_AGE_SECONDS = 3600;

export interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface ValidatedInitData {
  user: TgUser;
  authDate: number;
}

export function validateInitData(initDataRaw: string, botToken: string): ValidatedInitData {
  const params = new URLSearchParams(initDataRaw);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new UnauthorizedException('Некорректные initData');

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');

  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new UnauthorizedException('Некорректные initData');
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > MAX_AGE_SECONDS) {
    throw new UnauthorizedException('initData устарели');
  }

  let user: TgUser;
  try {
    user = JSON.parse(params.get('user') ?? '');
  } catch {
    throw new UnauthorizedException('Некорректные initData');
  }
  if (!user || typeof user.id !== 'number') {
    throw new UnauthorizedException('Некорректные initData');
  }

  return { user, authDate };
}

@Injectable()
export class InitDataGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    if (!header || !header.startsWith('tma ')) {
      throw new UnauthorizedException('Требуется авторизация Mini App');
    }

    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new UnauthorizedException('Бот не сконфигурирован');

    const { user } = validateInitData(header.slice(4), botToken);

    const adminId = Number(this.config.get<string>('ADMIN_TELEGRAM_ID'));
    if (user.id !== adminId) throw new ForbiddenException('Доступ запрещён');

    request.tgUser = user;
    return true;
  }
}
