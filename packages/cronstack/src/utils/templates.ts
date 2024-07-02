import cronstrue from 'cronstrue';

import { PACKAGE_NAME } from '@/constants';

export const MICROSERVICE = `import { BaseService } from '${PACKAGE_NAME}';

export default class Handler extends BaseService {
  interval: string = "%INTERVAL%"; // %HUMAN_INTERVAL%

  async handle(): Promise<void> {
    this.logger.log("Hello from %NAME% microservice!");
  }
}`;

export function namedMicroservice(name: string, interval: string = '*/10 * * * * *'): string {
  return MICROSERVICE.replace(/%NAME%/g, name)
    .replace(/%INTERVAL%/g, interval)
    .replace(/%HUMAN_INTERVAL%/g, cronstrue.toString(interval));
}
