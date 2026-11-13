# Package Inspector

**Understand your project. Find what matters. Know what to fix.**

Package Inspector is an early-stage, local-first TypeScript CLI for exploring software project metadata and identifying basic configuration and maintainability concerns. The long-term direction combines a **Project Explorer** with a **Project Health Doctor**.

> **Status:** Pre-release (`0.1.0`). The structured inspection engine is intentionally limited in scope. Findings are recommendations, not guarantees that a project is healthy or unhealthy.

## What works today

- Detect JavaScript/TypeScript, Python, Java/JVM, Rust, and Go projects from files in the selected folder.
- Inspect `package.json` metadata, dependencies, development dependencies, and npm scripts, with runtime type validation.
- Inspect `[project]` metadata from Python `pyproject.toml`, including dynamic versions and dependency declarations.
- Perform limited `requirements.txt` inspection by counting entries and identifying directives that were **not** expanded.
- Return structured diagnostics with stable rule identifiers, severity, explanation, and recommendation.
- Report inspection coverage honestly: `basic`, `limited`, or `detected-only`.
- Expose a reusable `inspectProject()` function independent of terminal formatting.
- Reject malformed supported project metadata with a non-zero CLI exit code.

Java/JVM, Rust, and Go are currently **detection-only**. When `pyproject.toml` and `requirements.txt` coexist, only `pyproject.toml` is inspected. Dependency installation, script execution, vulnerability auditing, and complete project structure discovery are **not** implemented.

## Prerequisites

- Node.js compatible with the project's TypeScript and `tsx` dependencies
- npm

## Getting started

```bash
git clone https://github.com/Drippyz1/package-inspector.git
cd package-inspector
npm ci
npm run dev
```

Inspect another folder:

```bash
npm run dev -- /path/to/project
```

## Example diagnostic

```text
Health Checks:
[WARN] [PI-NODE-002] No test script is configured
  No test script is configured. This does not necessarily mean the project has no tests.
  Recommendation: Add an npm test script or document the existing test workflow if one is used.
Total Warnings: 1
```

The absence of findings means only that **no current basic rules triggered**. The CLI prints an inspection-coverage section with the analysis limitations.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/detect.ts` | Detect recognized ecosystems from project files. |
| `src/inspectors/` | Read and validate ecosystem-specific metadata. |
| `src/health.ts` | Produce actionable findings from validated metadata. |
| `src/diagnostics.ts` | Shared, presentation-independent diagnostic contract. |
| `src/inspection.ts` | Reusable inspection orchestration and coverage tracking. |
| `src/terminal.ts` | Render inspection results in the terminal. |
| `src/index.ts` | CLI entry point and failure exit code. |

### Programmatic inspection

The inspection engine is reusable from TypeScript projects without invoking the CLI:

```ts
// Run `npm run build` first.
import { inspectProject } from "./dist/inspection.js";

const result = await inspectProject("./my-project");
console.log(result.detectedEcosystems);
console.log(result.diagnostics);
console.log(result.coverage);
```

This illustrates a relative import from a script in the repository root after building. Package Inspector does not yet publish or promise a stable external library API.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Planned work

- Richer Project Explorer summaries, framework detection, and workspace discovery.
- Evidence-backed health rules and more substantive configuration checks.
- Improved terminal reporting, JSON output, rule configuration, and CI integration.
- Additional ecosystem inspectors and eventual developer-tool integrations.

Package Inspector is designed for safe, offline-first inspection: it must not run scripts or install dependencies from inspected projects. Analysis coverage and unsupported functionality should always be disclosed.

## License

Source available under the **PolyForm Perimeter License 1.0.1**. See [LICENSE](LICENSE) for the complete terms. This repository is source-available, **not** OSI-approved open source.
