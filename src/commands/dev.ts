import { getHandlers, registerHandlers, RegisterOptions } from '@/lib/handler.ts';
import logger from '@/logger.ts';
import { Service } from '@/typings.ts';
import { handleError } from '@/utils/handle-error.ts';
import chalk from 'chalk';
import { watch } from 'chokidar';
import { Command } from 'commander';
import { CronJob } from 'cron';
import debounce from 'debounce';
import path from 'node:path';
import ora from 'ora';
import { z } from 'zod';

const LOADED_JOBS = new Map<string, CronJob>();

const devOptions = z.object({
  timeZone: z.string().default('UTC'),
  cwd: z.string().default(process.cwd()),
  services: z.array(z.string()).default([]),
  runOnce: z.boolean().default(false),
  onceNow: z.boolean().default(false)
});

type DevOptions = z.infer<typeof devOptions>;

export const dev = new Command()
  .command('dev')
  .description('Start services in development mode')
  .argument('[services...]', 'service names to start', [])
  .option('--time-zone <timeZone>', 'the time zone to use. defaults to "UTC".', 'UTC')
  .option('--once, --run-once', 'Run services once and exit. useful for testing.')
  .option('--once-now', 'Run services once immediately and exit. useful for testing.')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .action(async (services, opts) => {
    logger.log('');

    try {
      const options = devOptions.parse({
        ...opts,
        services
      });

      const { NODE_ENV } = process.env;
      if (!NODE_ENV) {
        process.env.NODE_ENV = 'development';
      }

      const startTime = new Date().getTime();
      const isOneTime = options.runOnce || options.onceNow;

      const progress = ora('Compiling services.').start();
      const handlers: Service[] = await getHandlers({
        cwd: options.cwd,
        services: options.services
      });

      if (handlers.length === 0) {
        logger.log(
          logger.red('[error]'),
          `No services found in ${chalk.bold(options.cwd)} directory.`
        );
        process.exitCode = 1;
        return;
      }

      // if options.onceNow is true, run handlers on parallel and exit
      if (options.onceNow) {
        const promises = handlers.map((handler) => handler.handle());
        await Promise.all(promises);
        process.exitCode = 0;
        return;
      }

      progress.start('Registering services.');
      await loadHandlers({
        handlers,
        timeZone: options.timeZone,
        once: isOneTime
      });

      watch(path.resolve(options.cwd, 'services'), {
        ignoreInitial: true
      }).on('all', () => handleOnChange(options));

      const elapsed = new Date().getTime() - startTime;
      progress.succeed(
        `Registered ${chalk.bold(LOADED_JOBS.size)} jobs in ${chalk.bold(elapsed)}ms.`
      );
      logger.log('');
    } catch (e) {
      handleError(e);
    }
  });

const ON_CHANGE_PROGRESS = ora();

const handleOnChange = debounce(async (options: DevOptions) => {
  logger.log('');
  logger.log(logger.highlight('[notice]'), 'Change detected. Reloading services.');

  for (const job of LOADED_JOBS.values()) {
    job.stop();
  }

  // wait till all jobs are stopped
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (LOADED_JOBS.size === 0) {
        clearInterval(interval);
        return resolve(null);
      }

      for (const [name, job] of LOADED_JOBS.entries()) {
        if (job.running) {
          return;
        }
        LOADED_JOBS.delete(name);
      }
    }, 100);
  });

  try {
    ON_CHANGE_PROGRESS.start('Compiling services.');
    const handler = await getHandlers({
      cwd: options.cwd,
      services: options.services,
      failOnError: false
    });

    ON_CHANGE_PROGRESS.start('Reloading services.');
    await loadHandlers({
      handlers: handler,
      timeZone: options.timeZone,
      once: false
    });

    ON_CHANGE_PROGRESS.succeed(`Reloaded ${chalk.bold(LOADED_JOBS.size)} jobs.`);
  } catch (_) {
    logger.log('');
    ON_CHANGE_PROGRESS.start('Waiting for changes.');
  }
}, 50);

async function loadHandlers(options: RegisterOptions) {
  const newJobs = await registerHandlers(options);
  for (const [name, job] of newJobs.entries()) {
    job.start();
    LOADED_JOBS.set(name, job);
  }
}

process.on('SIGTERM', function () {
  logger.log('SIGTERM received. Exiting...');

  for (const job of LOADED_JOBS.values()) {
    job.stop();
  }

  LOADED_JOBS.clear();

  logger.log('');
  process.exit(0);
});
