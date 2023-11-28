import { Command } from 'commander';
import logger from '@/logger.ts';
import { z } from 'zod';
import { handleError } from '@/utils/handle-error.ts';
import path from 'node:path';
import { promises } from 'node:fs';
import { fsAccess } from '@/utils/fs-access.ts';
import { namedMicroservice } from '@/utils/templates.ts';
import ora from 'ora';
import { getPackageManager } from '@/utils/get-package-manager.ts';
import { execa } from 'execa';

export const init = new Command().command('init <name>').action(async (opts) => {
  logger.log('');

  try {
    const options = z
      .object({
        cwd: z.string()
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
