# Optional MCP examples

These JSON files are configuration examples, not active connections:

- `playwright-mcp.example.json`: launches `@playwright/mcp@latest` using `npx`; the first launch can download third-party code. Pin a reviewed version when reproducibility is required.
- `context7-mcp.example.json`: connects to the remote endpoint declared in the file. Credentials and authentication are not bundled.

The examples use `mcpServers` and the helper's Antigravity JSON format. They cannot be copied directly into the existing VS Code `servers` configuration or Codex TOML configuration without adapting the schema.

For the preview, apply and backup workflow, see [../INSTALL.md](../INSTALL.md). No server is started by the helper. Keep secrets and private project data out of checked-in examples.
