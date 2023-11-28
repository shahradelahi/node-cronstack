#!/usr/bin/env node

import { Command } from 'commander';
import { fsAccess } from '@/utils/fs-access.ts';
import dotenv from 'dotenv';
import { init, start } from './commands';
import { add } from '@/commands/add.ts';
import { getPackageInfo } from '@/utils/get-package-info.ts';

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
