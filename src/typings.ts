import type { CronTime } from "cron";

export type LeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

export type SafeReturn<T, K = any> = LeastOne<{
  data: T;
  error: K;
}>;

export interface Service {
  // variables;
  name: string;
  interval: CronTime;
  running?: boolean;
  preventOverlapping?: boolean;
  // methods;
  handle: () => Promise<void>;
}