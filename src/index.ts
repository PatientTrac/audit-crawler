import { Command } from 'commander';
import { runWhatIf } from './modes/whatif.js';
import { runSingle } from './modes/single.js';
import { runGroup } from './modes/group.js';

const cli = new Command().name('audit-crawler');

cli.command('whatif')
  .argument('<domain>')
  .description('Dry run: discover + score the public surface. No capture, no DB writes.')
  .action(runWhatIf);

cli.command('run')
  .option('--target <domain>')
  .option('--group <name>')
  .action(async (o) => {
    if (o.target) return runSingle(o.target);
    if (o.group)  return runGroup(o.group);
    cli.error('Provide --target <domain> or --group <name>');
  });

cli.parse();
