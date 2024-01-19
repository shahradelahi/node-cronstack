import { getHandlerPaths, getHandlers, HandlerPath } from '@/lib/handler.ts';
import { transpileFile } from '@/lib/transpile.ts';
import logger from '@/logger.ts';
import { Service } from '@/typings.ts';
import { fsAccess } from '@/utils/fs-access.ts';
import { getModuleType } from '@/utils/get-package-info.ts';
import { handleError, sendError } from '@/utils/handle-error.ts';
import { randomString } from '@/utils/random.ts';
import chalk from 'chalk';
import { Command } from 'commander';
import { CronJob, CronTime } from 'cron';
import * as fs from 'fs';
import { promises } from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { z } from 'zod';

export const build = new Command()
  .command('build')
  .description('Build all services')
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
        .parse({
          ...opts
        });

      const startTime = new Date().getTime();
      const progress = ora('Compiling services.').start();

      const buildDir = path.join(options.cwd, '.microservice');
      if (await fsAccess(buildDir)) {
        await promises.rm(buildDir, { recursive: true });
      }

      const format = await getModuleType();

      const rawPaths = await getHandlerPaths(options.cwd);

      if (rawPaths.length === 0) {
        logger.log(
          logger.red('[error]'),
          `No services found in ${chalk.bold(options.cwd)} directory.`
        );
        process.exitCode = 1;
        return;
      }

      // transpile handlers
      const { error } = await transpileFile({
        entry: rawPaths.map((handler) => handler.path),
        outDir: buildDir,
        format: [format],
        minify: true,
        sourcemap: false
      });

      if (error) {
        handleError(error);
      }

      const buildId = getBuildId();
      await promises.writeFile(path.join(buildDir, 'BUILD_ID'), buildId);

      const elapsed = new Date().getTime() - startTime;
      progress.succeed(`All services compiled in ${elapsed}ms.`);
      logger.log('');
    } catch (e) {
      handleError(e);
    }
  });

function getBuildId() {
  const id = randomString(8);
  if (id[0].match(/[0-9]/)) {
    return getBuildId();
  }
  return `${id}-${randomString(4)}`;
}
