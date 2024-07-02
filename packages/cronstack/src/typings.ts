import type { CronTime } from 'cron';
import type { Options } from 'tsup';

export interface Service {
  name: string;
  interval: CronTime | string;
  running?: boolean;
  preventOverlapping?: boolean;
  verbose?: boolean;
  handle: () => Promise<void>;
}

export type TsupOptions = Options;
