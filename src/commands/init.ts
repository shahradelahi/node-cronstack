import logger from '@/logger.ts';
import { fsAccess } from '@/utils/fs-access.ts';
import { getPackageManager } from '@/utils/get-package-manager.ts';
import { handleError } from '@/utils/handle-error.ts';
import { namedMicroservice } from '@/utils/templates.ts';
import { Command } from 'commander';
import { execa } from 'execa';
import { promises } from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { z } from 'zod';

export const init = new Command()
  .command('init')
  .description('Initialize a new microservice')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .action(async (opts) => {
    logger.log('');

    try {
      const options = z
        .object({
          cwd: z.string().default(process.cwd())
        })
        .parse(opts);

      // create "services" directory and add "services/hello.ts" sample service
      const cwd = path.resolve(options.cwd);
      const servicesPath = path.join(cwd, 'services');

      if (!(await fsAccess(servicesPath))) {
        await promises.mkdir(servicesPath);
      }

      if (await fsAccess('services/hello.ts')) {
        await promises.writeFile('services/hello.ts', namedMicroservice('hello'));
      }

      // install dependencies
      const dependenciesSpinner = ora(`Installing dependencies...`)?.start();
      const packageManager = await getPackageManager(cwd);
      const deps = ['cron', 'dotenv'];

      await execa(packageManager, [packageManager === 'npm' ? 'install' : 'add', ...deps], {
        cwd: options.cwd
      });

      dependenciesSpinner?.succeed();

      logger.success('Microservice initialized successfully.');
    } catch (e) {
      handleError(e);
    }
  });
