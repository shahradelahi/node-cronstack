import logger from '@/logger';
import { fsAccess } from '@/utils/fs-access';
import { handleError } from '@/utils/handle-error';
import { namedMicroservice } from '@/utils/templates';
import chalk from 'chalk';
import { Command } from 'commander';
import cronstrue from 'cronstrue';
import { promises } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const add = new Command()
  .command('add <name>')
  .description('Add a new service')
  .option('-i, --interval <interval>', 'interval of the service', '* * * * *')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .action(async (name, opts) => {
    logger.log('');

    try {
      const options = z
        .object({
          name: z.string(),
          interval: z.string().default('* * * * *'),
          cwd: z.string().default(process.cwd())
        })
        .parse({ name, ...opts });

      // create "services" directory and add "services/+hello.service.ts" sample service
      const cwd = path.resolve(options.cwd);
      const servicesPath = path.join(cwd, 'services');

      if (!(await fsAccess(servicesPath))) {
        await promises.mkdir(servicesPath);
      }

      const servicePath = path.join(servicesPath, `+${name}.service.ts`);
      if (!(await fsAccess(servicePath))) {
        await promises.writeFile(servicePath, namedMicroservice(name, options.interval));
      }

      logger.info(chalk.green('Success!'), `Service "${servicePath}" added successfully.`);
      logger.log(`${name} ${options.interval} (${cronstrue.toString(options.interval)})`);
      logger.log('');
    } catch (e) {
      handleError(e);
    }
  });
