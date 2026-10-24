// Команда плагина в форме скилла ради голого `/<имя>` (docs/COMMAND_FRAMEWORK.md): validate-skill её пропускает, validate-command судит.
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import matter from 'gray-matter';

export const COMMAND_SKILLS = new Set(['dex-skill-subagent-dispatch:do']);

export function isCommandSkillFile(filepath) {
  if (basename(filepath) !== 'SKILL.md') return false;
  try {
    const plugin = JSON.parse(
      readFileSync(join(dirname(dirname(dirname(filepath))), '.claude-plugin', 'plugin.json'), 'utf8'),
    ).name;
    // `{}` гасит кэш gray-matter: без него бросивший разбор кэшируется, и read-failed в validateFile теряется.
    const name = matter(readFileSync(filepath, 'utf8'), {}).data?.name;
    return COMMAND_SKILLS.has(`${plugin}:${name}`);
  } catch {
    return false;
  }
}

export function commandName(filepath) {
  return basename(filepath) === 'SKILL.md' ? basename(dirname(filepath)) : basename(filepath, '.md');
}
