#!/usr/bin/env python3
"""Validate the project agent inventory and local references without external tools."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent


def validate():
    errors = []
    try:
        manifest = json.loads((ROOT / 'MANIFEST.json').read_text(encoding='utf-8'))
        if not isinstance(manifest, dict):
            raise ValueError('manifest must be an object')
    except (OSError, ValueError) as error:
        return [f'Manifest unreadable: {error}']

    if manifest.get('instructions') != 'AGENTS.md' or not (PROJECT / 'AGENTS.md').is_file():
        errors.append('Missing root AGENTS.md instruction entry point')
    if (ROOT / 'AGENTS.md').exists():
        errors.append('Duplicate instruction entry point: .agents/AGENTS.md')
    if list((ROOT / 'rules').glob('*.md')):
        errors.append('Duplicate rules directory: use root instructions and specialist skills')

    for key, directory, pattern in (
        ('skills', 'skills', '*/SKILL.md'),
        ('subagents', 'agents', '*.md'),
    ):
        expected = manifest.get(key)
        if not isinstance(expected, list) or not all(isinstance(item, str) for item in expected):
            errors.append(f'{key}: expected a list of names in manifest')
            continue
        if len(expected) != len(set(expected)):
            errors.append(f'{key}: duplicate manifest entries')
        files = sorted((ROOT / directory).glob(pattern))
        actual = {f.parent.name if key == 'skills' else f.name for f in files}
        if set(expected) != actual:
            errors.append(f'{key}: missing={sorted(set(expected) - actual)}, unlisted={sorted(actual - set(expected))}')
        for file in files:
            data = file.read_text(encoding='utf-8')
            frontmatter = re.match(r'\A---\n(.*?)\n---(?:\n|$)', data, re.S)
            if not frontmatter:
                errors.append(f'{file.relative_to(ROOT)}: missing YAML frontmatter')
                continue
            metadata = dict(re.findall(r'^([\w-]+):[ \t]*(.*)$', frontmatter[1], re.M))
            name = file.parent.name if key == 'skills' else file.stem
            if metadata.get('name') != name or not metadata.get('description', '').strip('" '):
                errors.append(f'{file.relative_to(ROOT)}: invalid name or description')
            if key == 'subagents' and metadata.get('subagent') != 'true':
                errors.append(f'{file.relative_to(ROOT)}: missing subagent: true')

    required = ('INSTALL.md', 'PROMPTS.md', 'SOURCES.md', 'knowledge/PROJECT_PROFILE.template.md',
                'configure_mcp.py', 'integrations/playwright-mcp.example.json',
                'integrations/context7-mcp.example.json')
    for name in required:
        if not (ROOT / name).is_file():
            errors.append(f'Missing {name}')

    for file in sorted(ROOT.rglob('*.example.json')):
        try:
            data = json.loads(file.read_text(encoding='utf-8'))
            if not isinstance(data, dict) or not isinstance(data.get('mcpServers'), dict):
                errors.append(f'{file.name}: expected mcpServers object')
            elif file.name.removesuffix('-mcp.example.json') not in data['mcpServers']:
                errors.append(f'{file.name}: missing named server')
        except (OSError, ValueError) as error:
            errors.append(f'{file.name}: invalid example: {error}')

    for file in [PROJECT / 'README.md', PROJECT / 'AGENTS.md', *sorted(ROOT.rglob('*.md'))]:
        if not file.is_file():
            errors.append(f'Missing {file}')
            continue
        data = file.read_text(encoding='utf-8')
        references = re.findall(r'`(\.\./\.\./[^`\n*]+)`', data)
        references += re.findall(r'\[[^]\n]+\]\(([^)\n]+)\)', data)
        for target in references:
            if '://' in target or target.startswith('#'):
                continue
            path = target.split('#', 1)[0]
            if not (file.parent / path).exists():
                errors.append(f'{file.relative_to(PROJECT)}: broken reference {target}')
    return errors


def main():
    try:
        errors = validate()
    except (OSError, UnicodeError) as error:
        errors = [f'Cannot read agent files: {error}']
    for error in errors:
        print('FAIL:', error)
    if errors:
        return 1
    print('PASS: project instructions, manifest inventory, metadata, references and MCP examples')
    print('Not tested: editor discovery or external tool connections.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
