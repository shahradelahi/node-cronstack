import { getHandlers } from '@/lib/handler.ts';
import logger from '@/logger.ts';
import { Service } from '@/typings.ts';
import { handleError, sendError } from '@/utils/handle-error.ts';
import chalk from 'chalk';
import { Command } from 'commander';
import { CronJob, CronTime } from 'cron';
import ora from 'ora';
import { z } from 'zod';

export const start = new Command()
  .command('start')
  .description('Start all services')
  .argument('[services...]', 'service names to start', [])
  .option('--time-zone <timeZone>', 'the time zone to use. defaults to "UTC".', 'UTC')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .action(async (services, opts) => {
    logger.log('');

    try {
      const options = z
        .object({
          timeZone: z.string().default('UTC'),
          cwd: z.string().default(process.cwd()),
          services: z.array(z.string()).default([])
        })
        .parse({
          ...opts,
          services
        });

      const startTime = new Date().getTime();

      let handlers: Service[] = await getHandlers(options.cwd);

      if (options.services.length > 0) {
        handlers = handlers.filter((handler) => options.services.includes(handler.name));
      }

      if (handlers.length === 0) {
        logger.log(
          logger.yellow('[warn]'),
          `No services found in ${chalk.bold(options.cwd)} directory.`
        );
        process.exitCode = 1;
        return;
      }

      const jobs = await registerHandlers(handlers);
      for (const job of jobs.values()) {
        job.start();
      }

      process.on('SIGINT', onExit(jobs));
      process.on('SIGTERM', onExit(jobs));

      const elapsed = new Date().getTime() - startTime;
      logger.log(
        logger.green('[success]'),
        `Registered ${chalk.bold(jobs.size)} jobs in ${chalk.bold(elapsed)}ms.`
      );
      logger.log('');
    } catch (e) {
      handleError(e);
    }
  });

async function registerHandlers(handlers: Service[]) {
  const jobs: Map<string, CronJob> = new Map();

  for (const handlerKey in handlers) {
    const handler: Service = handlers[handlerKey];

    if (jobs.has(handler.name)) {
      logger.log(
        logger.yellow('[warn]'),
        `Job "${chalk.bold(
          handler.name
        )}" not registered because another job with the same name already exists.`
      );
      continue;
    }

    const handleTick = async () => {
      if (handler.preventOverlapping) {
        if (handler.running) {
          logger.log(
            logger.yellow('[warn]'),
            `Job "${chalk.bold(handler.name)}" skipped because it is already running.`
          );
          return;
        }
        handler.running = true;
      }

      try {
        if (handler.verbose) {
          logger.log(chalk.cyan('[info]'), chalk.gray(`[${handler.name}]`), `Job started.`);
        }
        await handler.handle().then(() => {
          if (handler.verbose) {
            logger.log(chalk.green('[success]'), chalk.gray(`[${handler.name}]`), `Job completed.`);
          }
        });
      } catch (error) {
        logger.log(chalk.red('[error]'), chalk.gray(`[${handler.name}]`), `Job crashed.`);
        sendError(error);
      }

      if (handler.preventOverlapping) {
        handler.running = false;
      }
    };

    const job: CronJob = new CronJob('* * * * *', handleTick, null, false, 'UTC');

    const { interval } = handler;

    if (interval instanceof CronTime) {
      job.setTime(interval);
    } else if (typeof (interval as any) === 'string') {
      job.setTime(new CronTime(interval));
    } else {
      throw new Error(
        `Invalid interval type "${typeof handler.interval}" for job "${handler.name}"`
      );
    }

    jobs.set(handler.name, job);
  }

  return jobs;
}

const onExit = (jobs: Map<string, CronJob>) => {
  return () => {
    const stopProgress = ora('Stopping all jobs.').start();
    for (const job of jobs.values()) {
      job.stop();
    }
    stopProgress.succeed('All jobs stopped.');
    process.exit(0);
  };
};
