import { Controller, Get, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { InitDataGuard, TgUser } from '../guards/init-data.guard';
import { XuiExceptionFilter } from '../filters/xui-exception.filter';
import { XuiService } from '../../xui/xui.service';

@Controller('api/session')
@UseGuards(InitDataGuard)
@UseFilters(XuiExceptionFilter)
export class SessionController {
  constructor(private readonly xui: XuiService) {}

  @Get()
  async getSession(@Req() req: { tgUser: TgUser }) {
    let panel: { available: boolean; xrayState?: string; xrayVersion?: string };
    try {
      const status = await this.xui.serverStatus();
      panel = { available: true, xrayState: status.xray?.state, xrayVersion: status.xray?.version };
    } catch {
      panel = { available: false };
    }
    return { user: req.tgUser, panel };
  }

  @Post('login')
  async login() {
    await this.xui.forceLogin();
    return { ok: true };
  }

  @Post('logout')
  async logout() {
    await this.xui.logout();
    return { ok: true };
  }
}
