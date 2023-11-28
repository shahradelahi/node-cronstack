import logger from '@/logger.ts';
import { Service } from '@/typings.ts';
import { handleError } from '@/utils/handle-error.ts';
import { readDirectoryFiles } from '@/utils/read-directory-files.ts';
import chalk from 'chalk';
import { Command } from 'commander';
import { CronJob } from 'cron';
import path from 'node:path';
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

      const jobs: Map<string, CronJob> = new Map();
      let handlers: Service[] = await getHandlers(options.cwd);

      if (options.services.length > 0) {
        handlers = handlers.filter((handler) => options.services.includes(handler.name));
      }

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
            logger.log(logger.cyan('[info]'), `Job "${chalk.bold(handler.name)}" started.`);
            await handler.handle();
            logger.log(logger.green('[success]'), `Job "${chalk.bold(handler.name)}" completed.`);
          } catch (error) {
            logger.log(logger.red('[error]'), `Job "${chalk.bold(handler.name)}" crashed.`);
          }

          if (handler.preventOverlapping) {
            handler.running = false;
          }
        };

        const job: CronJob = new CronJob('* * * * *', handleTick, null, false, options.timeZone);
        job.setTime(handler.interval);

        jobs.set(handler.name, job);
      }

      logger.log(
        logger.cyan('[info]'),
        `Found ${chalk.bold(handlers.length)} handlers in ${logger.highlight(options.cwd)}.`
      );

      for (const job of jobs.values()) {
        job.start();
      }

      process.on('SIGINT', onExit(jobs));
      process.on('SIGTERM', onExit(jobs));

      const elapsed = new Date().getTime() - startTime;
      logger.log(logger.green('[success]'), 'All services registered in', elapsed, 'ms.');
      logger.log('');
    } catch (e) {
      handleError(e);
    }
  });

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

async function getModule(_path: string): Promise<any> {
  const absolutePath = path.isAbsolute(_path) ? _path : path.resolve(process.cwd(), _path);
  const module = await import(absolutePath);

  return module;
}

async function getHandlers(cwd: string): Promise<Service[]> {
  const handlerPath = path.join(cwd, 'services');

  const { data: files, error } = await readDirectoryFiles(handlerPath);
  if (!files || error) {
    throw new Error('Failed to read handlers directory');
  }

  const handlers: Service[] = [];
  for (const file of files) {
    const module = await getModule(file);
    if (!module.default) {
      throw new Error(`Handler ${file} does not have a default export`);
    }

    const handler = new module.default() as Service;
    handlers.push(handler);
  }

  return handlers;
}
