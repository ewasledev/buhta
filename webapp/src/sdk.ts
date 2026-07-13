import {
  init,
  backButton,
  themeParams,
  miniApp,
  mainButton,
  hapticFeedback,
  popup,
  viewport,
  retrieveRawInitData,
} from '@telegram-apps/sdk-react';

let insideTelegram = false;

/** Инициализация SDK; вне Telegram (dev в браузере) тихо деградирует. */
export function initSdk(): void {
  try {
    init();
    insideTelegram = true;
    if (themeParams.mountSync.isAvailable()) {
      themeParams.mountSync();
      themeParams.bindCssVars();
    }
    if (miniApp.mountSync.isAvailable()) {
      miniApp.mountSync();
      miniApp.bindCssVars();
    }
    if (backButton.mount.isAvailable()) backButton.mount();
    if (mainButton.mount.isAvailable()) mainButton.mount();
    if (viewport.mount.isAvailable()) {
      void viewport.mount().then(() => {
        if (viewport.expand.isAvailable()) viewport.expand();
      });
    }
  } catch {
    insideTelegram = false;
  }
}

export function getInitDataRaw(): string | undefined {
  try {
    return retrieveRawInitData();
  } catch {
    return undefined;
  }
}

export function haptic(type: 'light' | 'medium' | 'success' | 'error' = 'light'): void {
  try {
    if (type === 'success' || type === 'error') {
      if (hapticFeedback.notificationOccurred.isAvailable()) {
        hapticFeedback.notificationOccurred(type);
      }
    } else if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred(type);
    }
  } catch {
    // вне Telegram хаптики нет
  }
}

/** Confirm-диалог: нативный popup в Telegram, window.confirm вне его. */
export async function confirmDialog(message: string, title = 'Подтверждение'): Promise<boolean> {
  try {
    if (popup.open.isAvailable()) {
      const buttonId = await popup.open({
        title,
        message,
        buttons: [
          { id: 'ok', type: 'destructive', text: 'Да' },
          { id: 'cancel', type: 'cancel' },
        ],
      });
      return buttonId === 'ok';
    }
  } catch {
    // fallback ниже
  }
  return window.confirm(message);
}

export const tgBackButton = {
  show(onClick: () => void): VoidFunction {
    try {
      if (backButton.show.isAvailable()) {
        backButton.show();
        return backButton.onClick(onClick);
      }
    } catch {
      // вне Telegram кнопки нет
    }
    return () => undefined;
  },
  hide(): void {
    try {
      if (backButton.hide.isAvailable()) backButton.hide();
    } catch {
      // вне Telegram кнопки нет
    }
  },
};

export const tgMainButton = {
  show(text: string, onClick: () => void, loading = false): VoidFunction {
    try {
      if (mainButton.setParams.isAvailable()) {
        mainButton.setParams({ text, isVisible: true, isEnabled: !loading, isLoaderVisible: loading });
        return mainButton.onClick(onClick);
      }
    } catch {
      // вне Telegram кнопки нет
    }
    return () => undefined;
  },
  hide(): void {
    try {
      if (mainButton.setParams.isAvailable()) mainButton.setParams({ isVisible: false });
    } catch {
      // вне Telegram кнопки нет
    }
  },
};

export function isInsideTelegram(): boolean {
  return insideTelegram;
}
