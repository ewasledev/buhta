import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import { XuiService } from '../../xui/xui.service';

describe('DashboardService', () => {
  let xui: {
    serverStatus: ReturnType<typeof vi.fn>;
    onlines: ReturnType<typeof vi.fn>;
    listInboundsSlim: ReturnType<typeof vi.fn>;
    getPanelUpdateInfo: ReturnType<typeof vi.fn>;
  };
  let service: DashboardService;

  beforeEach(() => {
    xui = {
      serverStatus: vi.fn().mockResolvedValue({ cpu: 10 }),
      onlines: vi.fn().mockResolvedValue(['a@b']),
      listInboundsSlim: vi.fn().mockResolvedValue([{ id: 1 }]),
      getPanelUpdateInfo: vi.fn().mockResolvedValue({ hasUpdate: false }),
    };
    service = new DashboardService(xui as unknown as XuiService);
  });

  it('собирает все секции', async () => {
    await expect(service.getDashboard()).resolves.toEqual({
      status: { cpu: 10 },
      onlines: ['a@b'],
      inbounds: [{ id: 1 }],
      updateInfo: { hasUpdate: false },
    });
  });

  it('отказ одной секции → null, остальные живы', async () => {
    xui.onlines.mockRejectedValue(new Error('boom'));
    const result = await service.getDashboard();
    expect(result.onlines).toBeNull();
    expect(result.status).toEqual({ cpu: 10 });
    expect(result.inbounds).toEqual([{ id: 1 }]);
    expect(result.updateInfo).toEqual({ hasUpdate: false });
  });

  it('полный отказ панели → все секции null', async () => {
    for (const fn of Object.values(xui)) fn.mockRejectedValue(new Error('down'));
    await expect(service.getDashboard()).resolves.toEqual({
      status: null,
      onlines: null,
      inbounds: null,
      updateInfo: null,
    });
  });
});
