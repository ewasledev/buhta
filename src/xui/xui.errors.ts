export class XuiApiError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'XuiApiError';
  }
}

export class XuiConnectionError extends Error {
  constructor() {
    super('Панель недоступна');
    this.name = 'XuiConnectionError';
  }
}

export class XuiAuthError extends Error {
  constructor() {
    super('Не удалось авторизоваться в панели');
    this.name = 'XuiAuthError';
  }
}
