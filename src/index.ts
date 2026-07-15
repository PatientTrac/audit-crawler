import { Command } from 'commander';
import { runWhatIf } from './modes/whatif.js';
import { runSingle } from './modes/single.js';
import { runGroup } from './modes/group.js';
import { CONFIG } from './config.js';

const cli = new Command().name('audit-crawler');

cli.command('whatif')
  .argument('<domain>')
  .description('Dry run: discover + score the public surface. No capture, no DB writes.')
  .action(runWhatIf);

cli.command('run')
  .option('--target <domain>')
  .option('--group <name>')
  .option('--client-id <uuid>', 'audit.client UUID this run belongs to (falls back to CLIENT_ID env)')
  .action(async (o) => {
    const clientId = o.clientId ?? CONFIG.clientId;
    if (o.target) return runSingle(o.target, undefined, clientId);
    if (o.group)  return runGroup(o.group, clientId);
    cli.error('Provide --target <domain> or --group <name>');
  });

cli.parse();
