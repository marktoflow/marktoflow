/**
 * `marktoflow gui` command — Launch visual workflow designer.
 */

import chalk from 'chalk';
import ora from 'ora';

export interface GuiOptions {
  port: string;
  open?: boolean;
  workflow?: string;
  dir: string;
}

export async function executeGui(options: GuiOptions): Promise<void> {
  const spinner = ora('Starting GUI server...').start();

  try {
    // Check if @marktoflow/gui is available
    let guiModule;
    let guiPackagePath: string;
    try {
      guiModule = await import('@marktoflow/gui');
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      guiPackagePath = require.resolve('@marktoflow/gui');
    } catch {
      spinner.fail('@marktoflow/gui package not found');
      console.log(chalk.yellow('\nTo use the GUI, install the gui package:'));
      console.log(chalk.cyan('  npm install @marktoflow/gui@alpha'));
      console.log('\nOr run from the monorepo:');
      console.log(chalk.cyan('  pnpm --filter @marktoflow/gui dev'));
      process.exit(1);
    }

    spinner.succeed(`GUI server starting on http://localhost:${options.port}`);

    // Open browser if requested
    if (options.open) {
      const url = `http://localhost:${options.port}`;
      const { exec } = await import('node:child_process');
      const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${openCmd} ${url}`);
    }

    console.log('\n' + chalk.bold('Marktoflow GUI'));
    console.log(`  Server:    ${chalk.cyan(`http://localhost:${options.port}`)}`);
    console.log(`  Workflows: ${chalk.cyan(options.dir)}`);
    console.log('\n  Press ' + chalk.bold('Ctrl+C') + ' to stop\n');

    // Find the static files directory
    const { dirname, join } = await import('node:path');
    const guiPackageDir = dirname(dirname(dirname(guiPackagePath!)));
    const staticDir = join(guiPackageDir, 'dist', 'client');

    if (guiModule.startServer) {
      await guiModule.startServer({
        port: parseInt(options.port, 10),
        workflowDir: options.dir,
        staticDir: staticDir,
      });
    }
  } catch (error) {
    spinner.fail(`Failed to start GUI: ${error}`);
    process.exit(1);
  }
}
