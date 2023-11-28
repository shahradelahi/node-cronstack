import cronstrue from 'cronstrue';

export const MICROSERVICE = `import { CronTime } from "cron";
import logger from "microservice/logger";
import type { IService } from "microservice";

export default class Handler implements IService {
  name: string = "%NAME%";
  interval: CronTime = new CronTime("%INTERVAL%"); // %HUMAN_INTERVAL%

  async handle(): Promise<void> {
    logger.log("Hello from %NAME% microservice!");
  }
}`;

export function namedMicroservice(name: string, interval: string = '*/10 * * * * *'): string {
  return MICROSERVICE.replace(/%NAME%/g, name)
    .replace(/%INTERVAL%/g, interval)
    .replace(/%HUMAN_INTERVAL%/g, cronstrue.toString(interval));
}
