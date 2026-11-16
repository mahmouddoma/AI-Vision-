# Project agent setup

The agent is already placed in this repository. No installer or global configuration change is needed.

- `../AGENTS.md`: the only project instruction entry point; applies to the whole repository.
- `skills/`: specialist instructions, loaded on demand.
- `agents/`: optional read-only reviewer briefs, used only when delegation is requested.
- `templates/` and `knowledge/`: supporting checklists and templates.
- `MANIFEST.json`: inventory checked by the validator.
- `integrations/`: inactive examples for optional external tools.

Run from the project root:

```sh
python .agents/validate_agent.py
```

On Windows, use `py -3` if `python` is unavailable. Validation uses only the Python standard library. It checks local files; it does not prove that an editor has loaded instructions or connected external tools. Start a new agent conversation in this repository to pick up the root instructions.

## Optional MCP configuration

The existing `.vscode/mcp.json` contains the Angular CLI server definition. This task does not modify it. Use your editor's MCP manager to inspect actual server status.

`configure_mcp.py` writes an Antigravity-format JSON file using the bundled examples. It does not configure Codex or VS Code, download dependencies, start a server, authenticate or verify a connection. Keep your editor's supported schema and location in mind before using these examples.

Preview from the project root:

```sh
python .agents/configure_mcp.py --scope workspace --target . --tool playwright
```

Add `--apply` to save after reviewing the preview. Existing server names are replaced and other entries are preserved; an existing configuration is backed up first. Supported selections are `playwright`, `context7` and `both`. Global scope targets `~/.gemini/config/mcp_config.json`; it is optional and unnecessary for this project.

Examples stay inactive unless configured explicitly. Never commit credentials. See [integrations/README.md](integrations/README.md) for the example formats.
