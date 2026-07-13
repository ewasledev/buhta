import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientLinkService } from './client-link.service';
import { ClientsService } from '../../clients/clients.service';
import { XuiService } from '../../xui/xui.service';
import { XuiApiError } from '../../xui/xui.errors';

describe('ClientLinkService', () => {
  let clients: {
    findAllWithSubscriptions: ReturnType<typeof vi.fn>;
    setXuiEmail: ReturnType<typeof vi.fn>;
    findByXuiEmail: ReturnType<typeof vi.fn>;
  };
  let xui: { getPanelClient: ReturnType<typeof vi.fn> };
  let service: ClientLinkService;

  beforeEach(() => {
    clients = {
      findAllWithSubscriptions: vi.fn(),
      setXuiEmail: vi.fn(),
      findByXuiEmail: vi.fn(),
    };
    xui = { getPanelClient: vi.fn() };
    service = new ClientLinkService(
      clients as unknown as ClientsService,
      xui as unknown as XuiService,
    );
  });

  describe('link', () => {
    it('проверяет email в панели и сохраняет привязку', async () => {
      xui.getPanelClient.mockResolvedValue({ email: 'ivan@vpn' });
      clients.setXuiEmail.mockResolvedValue({ id: 1, xuiEmail: 'ivan@vpn' });
      await expect(service.link(1, 'ivan@vpn')).resolves.toEqual({ id: 1, xuiEmail: 'ivan@vpn' });
      expect(xui.getPanelClient).toHaveBeenCalledWith('ivan@vpn');
    });

    it('email не найден в панели → NotFoundException', async () => {
      xui.getPanelClient.mockResolvedValue(null);
      await expect(service.link(1, 'ghost@vpn')).rejects.toThrow(NotFoundException);
      expect(clients.setXuiEmail).not.toHaveBeenCalled();
    });

    it('ошибка панели пробрасывается', async () => {
      xui.getPanelClient.mockRejectedValue(new XuiApiError('client not found'));
      await expect(service.link(1, 'ghost@vpn')).rejects.toThrow(XuiApiError);
    });

    it('P2002 (email уже привязан) → ConflictException', async () => {
      xui.getPanelClient.mockResolvedValue({ email: 'ivan@vpn' });
      clients.setXuiEmail.mockRejectedValue(
        Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
      );
      await expect(service.link(1, 'ivan@vpn')).rejects.toThrow(ConflictException);
    });
  });

  describe('unlink', () => {
    it('сбрасывает xuiEmail', async () => {
      clients.setXuiEmail.mockResolvedValue({ id: 1, xuiEmail: null });
      await service.unlink(1);
      expect(clients.setXuiEmail).toHaveBeenCalledWith(1, null);
    });
  });

  describe('clearLinkByEmail', () => {
    it('чистит привязку у найденного клиента', async () => {
      clients.findByXuiEmail.mockResolvedValue({ id: 7 });
      await service.clearLinkByEmail('ivan@vpn');
      expect(clients.setXuiEmail).toHaveBeenCalledWith(7, null);
    });

    it('ничего не делает, если привязки нет', async () => {
      clients.findByXuiEmail.mockResolvedValue(null);
      await service.clearLinkByEmail('ghost@vpn');
      expect(clients.setXuiEmail).not.toHaveBeenCalled();
    });
  });

  describe('listBotClients', () => {
    it('мапит клиентов с последней подпиской', async () => {
      const endDate = new Date('2026-08-01');
      clients.findAllWithSubscriptions.mockResolvedValue([
        {
          id: 1,
          name: 'Ivan',
          isVip: true,
          price: 500,
          xuiEmail: 'ivan@vpn',
          subscriptions: [{ endDate }],
        },
        { id: 2, name: 'Petr', isVip: false, price: 0, xuiEmail: null, subscriptions: [] },
      ]);
      await expect(service.listBotClients()).resolves.toEqual([
        {
          id: 1,
          name: 'Ivan',
          isVip: true,
          price: 500,
          xuiEmail: 'ivan@vpn',
          subscriptionEnd: endDate,
        },
        { id: 2, name: 'Petr', isVip: false, price: 0, xuiEmail: null, subscriptionEnd: null },
      ]);
    });
  });

  describe('findLinked', () => {
    it('возвращает клиента бота по email панели', async () => {
      clients.findByXuiEmail.mockResolvedValue({ id: 3, name: 'Ivan', isVip: false });
      await expect(service.findLinked('ivan@vpn')).resolves.toEqual({
        id: 3,
        name: 'Ivan',
        isVip: false,
      });
    });
  });
});
