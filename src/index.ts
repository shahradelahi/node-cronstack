#!/usr/bin/env tsx

import { fsAccess } from '@/utils/fs-access.ts';
import { getPackageInfo } from '@/utils/get-package-info.ts';
import { Command } from 'commander';
import dotenv from 'dotenv';
import { add, init, start } from './commands';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
  const packageInfo = await getPackageInfo();

  const program = new Command()
    .name('microservice')
    .description('Manage your microservice')
    .version(packageInfo.version || '1.0.0', '-v, --version', 'display the version number');

  if (await fsAccess('.env')) {
    dotenv.config();
  }

  program.addCommand(init).addCommand(start).addCommand(add);

  program.parse();
}

main();
