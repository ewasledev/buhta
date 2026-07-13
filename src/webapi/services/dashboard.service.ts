import { Injectable } from '@nestjs/common';
import { XuiService } from '../../xui/xui.service';

function settled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly xui: XuiService) {}

  async getDashboard() {
    const [status, onlines, inbounds, updateInfo] = await Promise.allSettled([
      this.xui.serverStatus(),
      this.xui.onlines(),
      this.xui.listInboundsSlim(),
      this.xui.getPanelUpdateInfo(),
    ]);
    return {
      status: settled(status),
      onlines: settled(onlines),
      inbounds: settled(inbounds),
      updateInfo: settled(updateInfo),
    };
  }
}
