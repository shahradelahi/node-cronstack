import { getHandlers, registerHandlers, RegisterOptions } from '@/lib/handler.ts';
import logger from '@/logger.ts';
import { Service } from '@/typings.ts';
import { handleError } from '@/utils/handle-error.ts';
import chalk from 'chalk';
import { Command } from 'commander';
import { CronJob } from 'cron';
import ora from 'ora';
import { z } from 'zod';

const DevJobs = new Map<string, CronJob>();

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

      const startTime = new Date().getTime();
      const isOneTime = options.runOnce || options.onceNow;
      let compiled = false;

      const progress = ora('Compiling services.').start();
      const handlers: Service[] = await getHandlers({
        cwd: options.cwd,
        include: options.services,
        watch: !isOneTime,
        onSuccess: async () => {
          if (!compiled) {
            progress.succeed('All services compiled.');
            compiled = true;
            return;
          }
          await handleReloadSignal(options);
        }
      });

      if (handlers.length === 0) {
        logger.log(
          logger.red('[error]'),
          `No services found in ${chalk.bold(options.cwd)} directory.`
        );
        process.exitCode = 1;
        return;
      }

      const { NODE_ENV } = process.env;
      if (!NODE_ENV) {
        process.env.NODE_ENV = 'development';
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

      const elapsed = new Date().getTime() - startTime;
      progress.succeed(`Registered ${chalk.bold(DevJobs.size)} jobs in ${chalk.bold(elapsed)}ms.`);
      logger.log('');
    } catch (e) {
      handleError(e);
    }
  });

async function handleReloadSignal(options: DevOptions) {
  logger.log(logger.highlight('[notice]'), 'Detected changes in services.');
  logger.log('');

  const progress = ora('Reloading services.').start();

  for (const job of DevJobs.values()) {
    job.stop();
  }

  // wait till all jobs are stopped
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (DevJobs.size === 0) {
        clearInterval(interval);
        return resolve(null);
      }

      for (const [name, job] of DevJobs.entries()) {
        if (job.running) {
          return;
        }
        DevJobs.delete(name);
      }
    }, 100);
  });

  const handlers: Service[] = await getHandlers({
    cwd: options.cwd,
    include: options.services
  });
  console.log(handlers);

  await loadHandlers({
    handlers,
    timeZone: options.timeZone,
    once: false
  });

  progress.succeed(`Reloaded ${chalk.bold(DevJobs.size)} jobs.`);
  logger.log('');
}

async function loadHandlers(options: RegisterOptions) {
  const newJobs = await registerHandlers(options);
  for (const [name, job] of newJobs.entries()) {
    job.start();
    DevJobs.set(name, job);
  }
}

process.on('SIGTERM', function () {
  logger.log('SIGTERM received. Exiting...');

  for (const job of DevJobs.values()) {
    job.stop();
  }

  DevJobs.clear();

  logger.log('');
  process.exit(0);
});
