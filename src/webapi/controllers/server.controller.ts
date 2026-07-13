import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InitDataGuard } from '../guards/init-data.guard';
import { XuiExceptionFilter } from '../filters/xui-exception.filter';
import { XuiService } from '../../xui/xui.service';

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

@Controller('api/server')
@UseGuards(InitDataGuard)
@UseFilters(XuiExceptionFilter)
export class ServerController {
  constructor(private readonly xui: XuiService) {}

  @Get('status')
  status() {
    return this.xui.serverStatus();
  }

  @Get('history/:metric/:bucket')
  history(@Param('metric') metric: string, @Param('bucket', ParseIntPipe) bucket: number) {
    return this.xui.serverHistory(metric, bucket);
  }

  @Get('updates')
  async updates() {
    const [xrayVersions, panelUpdateInfo] = await Promise.allSettled([
      this.xui.getXrayVersions(),
      this.xui.getPanelUpdateInfo(),
    ]);
    return {
      xrayVersions: settled(xrayVersions),
      panelUpdateInfo: settled(panelUpdateInfo),
    };
  }

  @Post('xray/restart')
  restartXray() {
    return this.xui.restartXray();
  }

  @Post('xray/stop')
  stopXray() {
    return this.xui.stopXray();
  }

  @Post('xray/install/:version')
  installXray(@Param('version') version: string) {
    return this.xui.installXray(version);
  }

  @Post('panel/update')
  updatePanel() {
    return this.xui.updatePanel();
  }

  @Post('panel/restart')
  restartPanel() {
    return this.xui.restartPanel();
  }

  @Get('logs')
  logs(@Query('count') count?: string) {
    return this.xui.getLogs(count ? Number(count) : 100);
  }

  @Get('xray-logs')
  xrayLogs(@Query('count') count?: string) {
    return this.xui.getXrayLogs(count ? Number(count) : 100);
  }
}
