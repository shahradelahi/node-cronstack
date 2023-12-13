#!/usr/bin/env node

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
    .name('taskflow')
    .description('Manage your services with TaskFlow.')
    .version(packageInfo?.version || '0.0.0-dev', '-v, --version', 'display the version number');

  if (await fsAccess('.env')) {
    dotenv.config();
  }

  program.addCommand(init).addCommand(start).addCommand(add);

  program.parse();
}

main();
