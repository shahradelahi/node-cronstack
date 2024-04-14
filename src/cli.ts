#!/usr/bin/env node

import { PACKAGE_NAME, PROJECT_NAME } from '@/constants';
import { fsAccess } from '@/utils/fs-access';
import { getPackageInfo } from '@/utils/get-package-info';
import { Command } from 'commander';
import dotenv from 'dotenv';
import { add, build, dev, init, start } from './commands';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
  const packageInfo = await getPackageInfo();

  const program = new Command()
    .name(PACKAGE_NAME)
    .description(`Manage your services with ${PROJECT_NAME}.`)
    .version(packageInfo?.version || '0.0.0-dev', '-v, --version', 'display the version number');

  if (await fsAccess('.env')) {
    dotenv.config();
  }

  program.addCommand(add).addCommand(build).addCommand(dev).addCommand(init).addCommand(start);

  program.parse();
}

main();
