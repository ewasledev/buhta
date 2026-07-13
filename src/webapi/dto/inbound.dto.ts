export class CreateInboundDto {
  remark!: string;
  port!: number;
  protocol!: string;
  enable?: boolean;
  listen?: string;
  expiryTime?: number;
  total?: number;
  settings?: string;
  streamSettings?: string;
  sniffing?: string;
  [key: string]: unknown;
}

export class UpdateInboundDto extends CreateInboundDto {}
