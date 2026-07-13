import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InitDataGuard, TgUser } from '../guards/init-data.guard';

@Controller('api/session')
@UseGuards(InitDataGuard)
export class SessionController {
  @Get()
  getSession(@Req() req: { tgUser: TgUser }) {
    return { user: req.tgUser, panel: null };
  }
}
