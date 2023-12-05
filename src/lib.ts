import { ServiceLogger } from '@/logger.ts';
import { Service } from '@/typings.ts';
import chalk from 'chalk';
import { CronTime } from 'cron';

export * from '@/typings.ts';
export { default as logger } from '@/logger.ts';

export abstract class BaseService implements Service {
  name: string = '';
  abstract interval: CronTime | string;
  preventOverlapping: boolean = true;
  running: boolean = false;

  logger = ServiceLogger('unnamed');

  abstract handle(): Promise<void>;
}
