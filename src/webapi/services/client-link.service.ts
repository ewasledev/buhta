import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { XuiService } from '../../xui/xui.service';

@Injectable()
export class ClientLinkService {
  constructor(
    private readonly clients: ClientsService,
    private readonly xui: XuiService,
  ) {}

  async listBotClients() {
    const clients = await this.clients.findAllWithSubscriptions();
    return clients.map((c) => ({
      id: c.id,
      name: c.name,
      isVip: c.isVip,
      price: c.price,
      xuiEmail: c.xuiEmail,
      subscriptionEnd: c.subscriptions[0]?.endDate ?? null,
    }));
  }

  async link(clientId: number, xuiEmail: string) {
    const panelClient = await this.xui.getPanelClient(xuiEmail);
    if (!panelClient) throw new NotFoundException(`Клиент "${xuiEmail}" не найден в панели`);
    try {
      return await this.clients.setXuiEmail(clientId, xuiEmail);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') {
        throw new ConflictException(`"${xuiEmail}" уже привязан к другому клиенту`);
      }
      throw error;
    }
  }

  unlink(clientId: number) {
    return this.clients.setXuiEmail(clientId, null);
  }

  async clearLinkByEmail(email: string) {
    const client = await this.clients.findByXuiEmail(email);
    if (client) await this.clients.setXuiEmail(client.id, null);
  }

  findLinked(email: string) {
    return this.clients.findByXuiEmail(email);
  }
}
