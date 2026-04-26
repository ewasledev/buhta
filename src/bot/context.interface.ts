import { Scenes } from 'telegraf';

export interface WizardState {
  clientId?: number;
  subscriptionId?: number;
  mode?: 'add' | 'extend';
}

export type BotContext = Scenes.WizardContext & {
  match: RegExpExecArray;
  scene: Scenes.WizardContext['scene'] & { state: WizardState };
};
