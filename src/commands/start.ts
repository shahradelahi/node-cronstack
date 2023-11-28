import logger from '@/logger.ts';
import { Service } from '@/typings.ts';
import { handleError } from '@/utils/handle-error.ts';
import { readDirectoryFiles } from '@/utils/read-directory-files.ts';
import { Command } from 'commander';
import { CronJob } from 'cron';
import path from 'node:path';
import ora from 'ora';
import { z } from 'zod';

export const start = new Command()
  .command('start')
  .description('Start all services')
  .argument('[services...]', 'service names to start', [])
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
          cwd: z.string().default(process.cwd()),
          services: z.array(z.string()).default([])
        })
        .parse({
          ...opts,
          services
        });

      const jobs: Map<string, CronJob> = new Map();
      let handlers: Service[] = await getHandlers(options.cwd);

      if (options.services.length > 0) {
        handlers = handlers.filter((handler) => options.services.includes(handler.name));
      }

      for (const handlerKey in handlers) {
        const handler: Service = handlers[handlerKey];

        if (jobs.has(handler.name)) {
          logger.warn(
            `Job "${handler.name}" not registered because another job with the same name already exists.`
          );
          continue;
        }

        const handleTick = async () => {
          if (handler.preventOverlapping) {
            if (handler.running) {
              logger.warn(`Job "${handler.name}" skipped because it is already running.`);
              return;
            }
            handler.running = true;
          }

          try {
            logger.info(`Job "${handler.name}" started.`);
            await handler.handle();
            logger.success(`Job "${handler.name}" completed.`);
          } catch (error) {
            logger.error(`Job "${handler.name}" crashed.`);
          }

          if (handler.preventOverlapping) {
            handler.running = false;
          }
        };

        const job: CronJob = new CronJob('* * * * *', handleTick, null, false, 'Asia/Tehran');
        job.setTime(handler.interval);

        jobs.set(handler.name, job);
      }

      logger.info(`Starting ${jobs.size} jobs.`);

      for (const job of jobs.values()) {
        job.start();
      }

      process.on('SIGINT', onSigint(jobs));

      logger.success('All jobs started.');
    } catch (e) {
      handleError(e);
    }
  });

const onSigint = (jobs: Map<string, CronJob>) => {
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
  return await import(absolutePath);
}

async function getHandlers(cwd: string): Promise<Service[]> {
  const handlersPath = path.join(cwd, 'services');

  const { data: files, error } = await readDirectoryFiles(handlersPath);
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
