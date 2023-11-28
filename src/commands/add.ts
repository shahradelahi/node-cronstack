import { Command } from 'commander';
import logger from '@/logger.ts';
import { z } from 'zod';
import path from 'node:path';
import { promises } from 'node:fs';
import { fsAccess } from '@/utils/fs-access.ts';
import { namedMicroservice } from '@/utils/templates.ts';
import cronstrue from 'cronstrue';
import { handleError } from '@/utils/handle-error.ts';

export const add = new Command()
  .argument('add <name>', 'name of the service')
  .option('-i, --interval <interval>', 'interval of the service', '* * * * *')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .action(async (name: string, opts) => {
    try {
      const options = z
        .object({
          name: z.string(),
          interval: z.string().default('* * * * *'),
          cwd: z.string().default(process.cwd())
        })
        .parse({ name, ...opts });

      // create "services" directory and add "services/hello.ts" sample service
      const cwd = path.resolve(options.cwd);
      const servicesPath = path.join(cwd, 'services');

      if (!(await fsAccess(servicesPath))) {
        await promises.mkdir(servicesPath);
      }

      const servicePath = path.join(servicesPath, `${name}.ts`);
      if (!(await fsAccess(servicePath))) {
        await promises.writeFile(servicePath, namedMicroservice(name, options.interval));
      }

      logger.success(`Service "${servicePath}" added successfully.`);
      logger.log(`${name} ${options.interval} (${cronstrue.toString(options.interval)})`);
    } catch (e) {
      handleError(e);
    }
  });
