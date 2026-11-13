# Package Inspector

**Understand your project. Find what matters. Know what to fix.**

Package Inspector is an early-stage, local-first developer CLI that combines a **Project Explorer** with a **Project Health Doctor**. It identifies project metadata and recognized configuration files, reports inspection scope honestly, and provides actionable recommendations for supported ecosystems.

> **Status:** Pre-release (`0.1.0`). This is a foundation for more capable analysis, **not** a full project audit, dependency resolver, vulnerability scanner, or runtime verifier.

## Features

### Project Explorer (Sprint #9)

- Discover project ecosystems from recognized root-level manifests: JavaScript/TypeScript, Python, Java/JVM, Rust, and Go.
- Show separate project identities for validated Node.js and Python manifests, including version source and the manifest used.
- Identify recognized root-level manifests, configuration files, documentation, workspace markers, and lockfiles.
- Distinguish files actually **inspected** from files merely **detected**.
- Show package-manager **evidence** from npm, pnpm, Yarn, or Bun lockfiles. Multiple lockfiles are reported as evidence, not assumed to be an error.
- List a small allowlist of common top-level directories, such as `src`, `tests`, `packages`, and `docs`.
- Avoid recursing through project trees and following symbolic links during discovery.

### Project Health Doctor

- Validate selected `package.json` fields and report basic Node.js maintainability recommendations.
- Parse standard `[project]` metadata in Python `pyproject.toml`, including dynamic-version declarations.
- Perform limited `requirements.txt` inspection: count entries and identify directives that were not expanded.
- Return typed diagnostics with stable IDs, severity, explanation, and recommendation.
- Keep malformed supported configuration errors **fatal**, separate from nonfatal health advice.
- Disclose ecosystem coverage as `basic`, `limited`, or `detected-only`.

**Important limitations:** Java/JVM, Rust, and Go are detected but not parsed. Framework detection, workspace traversal, dependency resolution, lockfile parsing, vulnerability scanning, and actual test execution are not provided. If `pyproject.toml` and `requirements.txt` coexist, only `pyproject.toml` is inspected. The Explorer identifies root-level files but does not validate their content unless an existing inspector explicitly reads them. Absence of a warning is not proof of project health.

## Requirements and installation

Install a Node.js version compatible with this repository's `typescript` and `tsx` dependencies, then:

```bash
git clone https://github.com/Drippyz1/package-inspector.git
cd package-inspector
npm ci
```

Inspect the repository itself:

```bash
npm run dev
```

Inspect another folder:

```bash
npm run dev -- /path/to/project
```

Build and run compiled output:

```bash
npm run build
node dist/index.js /path/to/project
```

## Example output

```text
Package Inspector
Version: 0.1.0
Description: A tool for inspecting software projects
Selected folder: ./sample-app
Detected Ecosystems: JavaScript / TypeScript
Project Explorer:
  Discovery Scope: Project root only (no recursive scanning)
  Project Identities:
  - JavaScript / TypeScript: sample-app (v1.2.3; package.json)
  Recognized Files:
  - package-lock.json [lockfile, detected-only]
  - package.json [manifest, inspected]
  - README.md [documentation, detected-only]
  Package Manager Evidence: npm (package-lock.json)
  Workspace Markers: None detected
  Common Directories: src, tests
Detected Project: sample-app
Detected Version: 1.2.3
...
Health Checks:
[PASS] No basic warnings found.
Inspection Coverage:
- JavaScript / TypeScript [basic]: package.json metadata and basic health checks only; no script execution, dependency resolution, or vulnerability audit.
```

The example represents a hypothetical project; other project layouts and rule findings will produce different output.

## Programmatic use

`inspectProject()` returns ecosystem-specific validated sections **and** a cross-ecosystem `overview`:

```ts
// After `npm run build`, from a script in the repository root:
import { inspectProject } from "./dist/inspection.js";

const result = await inspectProject("./sample-app");

console.log(result.overview.identities);
console.log(result.overview.recognizedFiles);
console.log(result.overview.packageManagerEvidence);
console.log(result.diagnostics);
console.log(result.coverage);
```

This is an internal reusable TypeScript API, not yet a published or versioned library contract. Invalid metadata rejects with an error rather than being converted into a nonfatal warning. For unsupported-only folders the engine still returns discovery facts; the CLI currently exits unsuccessfully.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/detect.ts` | Ecosystem detection using file names (also exposes a pure detection function). |
| `src/project.ts` | Shared project model and root-level Explorer discovery. |
| `src/inspectors/` | Read and validate supported ecosystem-specific project metadata. |
| `src/health.ts` | Generate basic, structured health recommendations. |
| `src/diagnostics.ts` | Presentation-independent diagnostic contract. |
| `src/inspection.ts` | Single-root-scan orchestration, aggregation, and coverage. |
| `src/terminal.ts` | Terminal display and output sanitization. |
| `src/index.ts` | CLI entry point and exit behavior. |
| `tests/` | Integration and unit/regression tests. |
| `docs/architecture.md` | Engineering architecture and extension guidance. |

## Verification

```bash
npm run typecheck
npm test
npm run build
```

`npm test` uses Node's built-in test runner and the TypeScript test loader. The CLI **does not** execute the inspected project's scripts or install its dependencies. It performs local filesystem inspection only.

## Planned directions

- More substantive framework, package manager, and workspace discovery.
- Evidence-backed health rules, with clear severity and remediation guidance.
- Better terminal presentation, machine-readable output, and configurable rules.
- Additional ecosystem-specific inspectors and future developer integrations.

See [Architecture](docs/architecture.md) for design constraints, supported boundaries, and how to extend this tool.

## License

Source available under the **PolyForm Perimeter License 1.0.1**. See [LICENSE](LICENSE) for the complete terms. This project is **source-available, not OSI-approved open source**.
