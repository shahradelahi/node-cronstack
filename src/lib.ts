import { Service } from '@/typings.ts';
import { CronTime } from 'cron';

export * from '@/typings.ts';
export { default as logger } from '@/logger.ts';

export abstract class BaseService implements Service {
  abstract name: string;
  abstract interval: CronTime;
  preventOverlapping: boolean = true;
  running: boolean = false;

  abstract handle(): Promise<void>;
}
