import { ServiceLogger } from '@/logger';
import { Service } from '@/typings';
import { CronTime } from 'cron';

export * from '@/typings';
export { default as logger } from '@/logger';

export abstract class BaseService implements Service {
  name: string = '';
  abstract interval: CronTime | string;
  preventOverlapping: boolean = true;
  running: boolean = false;

  logger = ServiceLogger('unnamed');

  abstract handle(): Promise<void>;
}
