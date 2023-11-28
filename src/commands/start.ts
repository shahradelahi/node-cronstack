import { Command } from 'commander';
import logger from '@/logger.ts';
import { z } from 'zod';
import { handleError } from '@/utils/handle-error.ts';
import { CronJob } from 'cron';
import { Service } from '@/typings.ts';
import path from 'node:path';
import { readDirectoryFiles } from '@/utils/read-directory-files.ts';

const makeProfileOptionsSchema = z.object({
  name: z.string(),
  endpointUrl: z.string(),
  token: z.string(),
  force: z.boolean()
});

export const start = new Command()
  .command('start')
  .description('Create a new vault profile')
  .action(async (opts) => {
    logger.log('');

    try {
      const options = makeProfileOptionsSchema.parse({});

      const jobs: Map<string, CronJob> = new Map();
      const handlers: Service[] = await getHandlers();

      for (const handlersKey in handlers) {
        const handler: Service = handlers[handlersKey];

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

      logger.success('All jobs started.');

      process.on('SIGINT', () => {
        logger.info('Stopping all jobs.');
        for (const job of jobs.values()) {
          job.stop();
        }
        logger.success('All jobs stopped.');
        process.exit(0);
      });
    } catch (e) {
      handleError(e);
    }
  });

async function getModule(_path: string): Promise<any> {
  const absolutePath = path.isAbsolute(_path) ? _path : path.resolve(process.cwd(), _path);
  return await import(absolutePath);
}

async function getHandlers(): Promise<Service[]> {
  const handlersPath = path.join(process.cwd(), 'services');
  const { data: files, error } = await readDirectoryFiles(handlersPath);
  if (!files || error) {
    throw new Error('Failed to read handlers directory');
  }

  const handlers: Service[] = [];
  for (const file of files) {
    const module = await getModule(file);
    if (!module.default) {
      logger.warn(`Handler ${file} does not have a default export`);
      continue;
    }
    const handler = new module.default() as Service;
    handlers.push(handler);
  }

  return handlers;
}
