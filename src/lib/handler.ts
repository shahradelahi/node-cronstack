import { BUILD_OUTPUT_DIR } from '@/constants';
import { getHandlerPaths } from '@/lib/service-finder';
import { transpileFile } from '@/lib/transpile';
import logger, { ServiceLogger } from '@/logger';
import { Service } from '@/typings';
import { fsAccess, fsAccessSync } from '@/utils/fs-access';
import { getModule } from '@/utils/get-module';
import { getModuleType } from '@/utils/get-package-info';
import { sendError } from '@/utils/handle-error';
import chalk from 'chalk';
import { CronJob, CronTime } from 'cron';
import { promises } from 'node:fs';
import path from 'node:path';
import type { Options } from 'tsup';

type TranspiledHandler = {
  filePath: string;
  name: string;
};

export async function getHandler({ filePath, name }: TranspiledHandler): Promise<Service> {
  const format = await getModuleType();

  const module = await getModule(filePath);
  if (!module.default) {
    throw new Error(`Handler ${filePath} does not have a default export`);
  }

  const handler = format === 'cjs' ? module.default['default'] : module.default;
  if (!handler) {
    throw new Error(`Handler not found in ${filePath}`);
  }

  const handlerInstance = new (handler as any)() as Service;
  handlerInstance.name = name;
  handlerInstance.logger = ServiceLogger(name);

  return handlerInstance;
}

type GetHandlerOptions = Omit<TranspileServicesOptions, 'outDir'> & {
  cwd: string;
};

export async function getHandlers({ cwd, ...options }: GetHandlerOptions): Promise<Service[]> {
  const outDir = path.join(cwd, BUILD_OUTPUT_DIR);
  if (await fsAccess(outDir)) {
    await promises.rm(outDir, { recursive: true });
  }

  await transpileServices({ ...options, cwd, outDir });

  const transpiledHandlers = await getHandlerPaths(outDir, '');

  const modulePaths = transpiledHandlers.map((handler) => ({
    filePath: handler.path,
    name: handler.name
  }));

  const handlers: Service[] = [];
  for (const modulePath of modulePaths) {
    const handler = await getHandler(modulePath);
    handlers.push(handler);
  }

  return handlers;
}

type TranspileServicesOptions = Pick<Options, 'minify' | 'sourcemap'> & {
  cwd: string;
  outDir: string;
  services?: string[];
  failOnError?: boolean;
};

export async function transpileServices(opts: TranspileServicesOptions): Promise<void> {
  const { cwd, outDir, failOnError, services, ...options } = opts;

  const format = await getModuleType();
  let entryPaths = await getHandlerPaths(cwd);

  if (Array.isArray(services) && services.length > 0) {
    entryPaths = entryPaths.filter((handler) => services.includes(handler.name));
  }

  entryPaths = entryPaths.filter((handler) => fsAccessSync(handler.path)); // filter out non-existent files

  // transpile handlers
  const { error } = await transpileFile({
    outDir,
    entry: entryPaths.map((handler) => handler.path),
    format: [format],
    ...options
  });

  if (failOnError !== false && error) {
    throw new Error('Failed to transpile handlers');
  }
}

export type HandlerPath = {
  path: string;
  name: string;
};

export type RegisterOptions = {
  handlers: Service[];
  once?: boolean;
  timeZone?: string;
};

export async function registerHandlers(options: RegisterOptions) {
  const { handlers, ...opts } = options;

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
          logger.log(chalk.cyan('[info]'), chalk.gray(`[${handler.name}]`), `Job has started.`);
        }
        await handler.handle().then(() => {
          if (handler.verbose) {
            logger.log(
              chalk.green('[success]'),
              chalk.gray(`[${handler.name}]`),
              `Job has completed.`
            );
          }
        });
      } catch (error) {
        logger.log(chalk.red('[error]'), chalk.gray(`[${handler.name}]`), `Job has crashed.`);
        sendError(error);
      }

      if (handler.preventOverlapping) {
        handler.running = false;
      }
    };

    const job: CronJob = new CronJob('* * * * *', handleTick, null, false, opts.timeZone);
    job.addCallback(() => {
      // if opts.once is true, stop the job
      if (opts.once) {
        job.stop();
      }
    });

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
