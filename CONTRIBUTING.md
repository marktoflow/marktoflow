# Contributing to marktoflow

Thank you for your interest in contributing to marktoflow! This document provides guidelines for contributing to the project.

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/marktoflow/marktoflow.git
cd marktoflow

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start the visual designer
pnpm --filter @marktoflow/gui dev
```

---

## Development Setup

### Prerequisites

- **Node.js**: >=20.0.0
- **pnpm**: >=9.0.0 (install with `npm install -g pnpm`)
- **Git**: Latest version

### Project Structure

```
marktoflow/
├── packages/
│   ├── core/                 # Parser, engine, state, security, costs
│   │   ├── src/              # Source code
│   │   ├── tests/            # Unit tests
│   │   └── integration-tests/ # Integration tests
│   ├── integrations/         # Service integrations + AI adapters
│   │   ├── src/
│   │   │   ├── services/     # 30+ native integrations
│   │   │   ├── adapters/     # AI agents (Copilot, Claude, Ollama)
│   │   │   └── reliability/  # Input validation schemas
│   │   └── tests/
│   │       └── reliability/  # Contract tests with MSW
│   ├── cli/                  # CLI commands, OAuth flows
│   ├── gui/                  # Visual workflow designer
│   └── marktoflow/           # Meta-package
├── examples/                 # Production-ready workflow templates
├── docs/                     # Documentation
└── scripts/                  # Build and publish scripts
```

### Key Packages

- **@marktoflow/core** - Core engine (parser, executor, state management)
- **@marktoflow/integrations** - Service integrations and AI adapters
- **@marktoflow/cli** - Command-line interface
- **@marktoflow/gui** - Web-based workflow designer
- **@marktoflow/marktoflow** - Meta-package (installs everything)

### Development Workflow

1. **Create a Branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-fix-name
   ```

2. **Make Changes**

   - Write code following existing patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**

   ```bash
   # Run all tests
   pnpm test

   # Test specific package
   pnpm test --filter=@marktoflow/core

   # Run in watch mode
   pnpm test --watch
   ```

4. **Build**

   ```bash
   # Build all packages
   pnpm build

   # Build specific package
   pnpm --filter @marktoflow/core build
   ```

5. **Commit Changes**

   Follow conventional commit format:

   ```bash
   git commit -m "feat(core): add new feature"
   git commit -m "fix(gui): resolve issue"
   git commit -m "docs: update README"
   ```

   **Commit types**:
   - `feat`: New feature
   - `fix`: Bug fix
   - `docs`: Documentation changes
   - `test`: Test changes
   - `chore`: Build/tooling changes
   - `refactor`: Code refactoring
   - `perf`: Performance improvements

6. **Push and Create PR**

   ```bash
   git push origin feature/your-feature-name
   ```

   Then create a Pull Request on GitHub.

---

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use proper type annotations (avoid `any`)
- Follow existing naming conventions

### Formatting

- We use Prettier for formatting
- Configuration is in `.prettierrc`
- Format before committing:

  ```bash
  pnpm format
  ```

### Linting

- We use ESLint for linting
- Fix linting issues:

  ```bash
  pnpm lint
  ```

---

## Testing

### Writing Tests

- Use Vitest for testing
- Place tests next to source files with `.test.ts` extension
- Write descriptive test names
- Test edge cases and error conditions

**Example**:

```typescript
import { describe, it, expect } from 'vitest';
import { parseFile } from './parser';

describe('parseFile', () => {
  it('should parse valid workflow file', () => {
    const result = parseFile('test.md');
    expect(result.workflow.id).toBe('test');
  });

  it('should throw error for invalid YAML', () => {
    expect(() => parseFile('invalid.md')).toThrow();
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm test --filter=@marktoflow/core

# Watch mode
pnpm test --watch

# With coverage
pnpm test --coverage
```

---

## Adding Integrations

To add a new service integration:

1. Create integration file in `packages/integrations/src/services/`
2. Implement the `SDKInitializer` interface
3. Add tests
4. Update documentation
5. Add to exports in `packages/integrations/src/index.ts`

**Example**:

```typescript
// packages/integrations/src/services/example.ts
import { SDKInitializer } from '@marktoflow/core';
import ExampleSDK from 'example-sdk';

export const ExampleInitializer: SDKInitializer = {
  name: 'example',
  async initialize(config) {
    return new ExampleSDK(config.auth.token);
  },
  actions: {
    'send': async (sdk, inputs) => sdk.send(inputs),
  },
};
```

See [AGENTS.md](AGENTS.md) for detailed integration patterns.

---

## Documentation

### When to Update Documentation

- Adding new features
- Changing existing behavior
- Adding integrations
- Updating configuration

### Documentation Files

- `README.md` - Main project overview
- `AGENTS.md` - Development guidance
- `docs/` - Detailed guides
- `examples/` - Example workflows
- Package-specific `README.md` files

### Writing Style

- Be clear and concise
- Include code examples
- Use markdown formatting
- Test all code examples

---

## Publishing

**Note**: Only maintainers can publish packages to npm.

marktoflow uses an **automated publishing system** for safe, reproducible releases.

### For Maintainers

```bash
# Test publish process
pnpm publish:dry-run

# Publish for real
pnpm publish
```

See **[docs/PUBLISHING.md](docs/PUBLISHING.md)** for complete publishing guide.

### For Contributors

You don't need to publish packages. Focus on:
- Writing code
- Adding tests
- Updating documentation
- Creating PRs

Maintainers will handle publishing after your PR is merged.

---

## Pull Request Process

### Before Submitting

- [ ] Tests pass (`pnpm test`)
- [ ] Code is formatted (`pnpm format`)
- [ ] No linting errors (`pnpm lint`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format

### PR Description

Include:
- **What**: What does this PR do?
- **Why**: Why is this change needed?
- **How**: How does it work?
- **Testing**: How was it tested?

**Example**:

```markdown
## What
Adds support for Notion integration

## Why
Users requested Notion integration for workflow automation

## How
- Implemented SDKInitializer for Notion SDK
- Added tests for all actions
- Updated integration docs

## Testing
- Unit tests pass
- Tested with real Notion workspace
- Added example workflow
```

### PR Review

- Maintainers will review your PR
- Address feedback promptly
- Keep the PR focused on one feature/fix
- Be responsive to questions

---

## Getting Help

### Resources

- **Documentation**: [docs/](docs/)
- **Examples**: [examples/](examples/)
- **Issues**: [GitHub Issues](https://github.com/marktoflow/marktoflow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/marktoflow/marktoflow/discussions)

### Questions

If you have questions:
1. Check existing documentation
2. Search GitHub Issues
3. Ask in GitHub Discussions
4. Open a new issue

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Public or private harassment
- Publishing others' private information

### Enforcement

Violations may result in:
- Warning
- Temporary ban
- Permanent ban

Report violations to: scottgl@gmail.com

---

## License

By contributing to marktoflow, you agree that your contributions will be licensed under the Apache License 2.0.

---

## Thank You!

Your contributions make marktoflow better for everyone. We appreciate your time and effort!

**Questions?** Open an issue or start a discussion on GitHub.
