import { describe, expect, it, vi } from 'vitest';
import { ServerController } from './server.controller';
import { XuiService } from '../../xui/xui.service';

describe('ServerController', () => {
  it('newX25519 проксирует генерацию ключей в XuiService', async () => {
    const xui = {
      getNewX25519Cert: vi.fn().mockResolvedValue({ privateKey: 'priv', publicKey: 'pub' }),
    };
    const controller = new ServerController(xui as unknown as XuiService);
    await expect(controller.newX25519()).resolves.toEqual({ privateKey: 'priv', publicKey: 'pub' });
    expect(xui.getNewX25519Cert).toHaveBeenCalledOnce();
  });
});
