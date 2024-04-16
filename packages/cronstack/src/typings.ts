import { ServiceLogger } from '@/logger';
import type { CronTime } from 'cron';
import type { Options } from 'tsup';

export type LeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type SafeReturn<T, K = any> = LeastOne<{
  data: T;
  error: K;
}>;

export interface Service {
  name: string;
  interval: CronTime | string;
  running?: boolean;
  preventOverlapping?: boolean;
  logger: ReturnType<typeof ServiceLogger>;
  verbose?: boolean;
  handle: () => Promise<void>;
}

export type TsupOptions = Options;
