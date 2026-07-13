export class PanelClientFieldsDto {
  email!: string;
  /** байты, несмотря на имя; 0 = безлимит */
  totalGB?: number;
  /** ms-epoch; 0 = бессрочно */
  expiryTime?: number;
  limitIp?: number;
  enable?: boolean;
  comment?: string;
  flow?: string;
  [key: string]: unknown;
}

export class CreatePanelClientDto {
  client!: PanelClientFieldsDto;
  inboundIds!: number[];
}

export class UpdatePanelClientDto extends PanelClientFieldsDto {}

export class BulkAdjustDto {
  emails!: string[];
  addDays?: number;
  addBytes?: number;
}
