# Package Inspector architecture

> Sprint #10 checkpoint for Package Inspector `0.1.0`.

## Purpose

The tool answers two separate questions about a local project:

1. **Explorer:** Which ecosystem manifests, documentation files, recognized configuration files, package-manager lockfiles, and common directories can we identify *without executing the project*?
2. **Health Doctor:** Based on metadata we actually parsed and validated, which limited, actionable recommendations can we support with evidence?

These questions share discovery and validated metadata. They must not become duplicate scanners or contradictory sources of truth.

## Data flow

```text
CLI arguments -> validate options and optional path
    |
    +-- help or version -> print and exit
    |
    v
readdir(projectPath, { withFileTypes: true })   [one root directory listing]
    |
    v
indexRootEntries()  ---> detectEcosystemsFromFiles()
    |                                    |
    +------------------------------------+
    |
    v
Supported manifest inspectors  [package.json or Python metadata]
    |                                    |
    +-- fatal validation errors           +-- unsupported ecosystems: detected-only
    |
    v
InspectionSection[]  ---> health rules -> Diagnostic[]
    |
    +-- buildProjectOverview(root, sections) -> ProjectOverview
    |
    v
InspectionResult { projectPath, detectedEcosystems, overview, sections,
                   diagnostics, coverage }
    |
    +-- summarizeInspection(result) -> InspectionSummary
    |
    v
terminal.ts uses both models for standard and brief CLI reports
```

`src/inspection.ts` is the sole orchestration entry point. It performs **one root directory listing** and calls existing ecosystem inspectors when supported. `src/detect.ts` retains the original `detectEcosystems(path)` API for compatibility, while `detectEcosystemsFromFiles()` uses the existing root-file set to avoid a redundant listing in the orchestrator.

## Shared project model (`src/project.ts`)

The public `ProjectOverview` type contains:

| Field | Meaning | Guarantees |
| --- | --- | --- |
| `scope` | Currently `project-root` | No recursive inventory is implied. |
| `identities` | One identity per validated Node or Python section | Names and versions are never inferred for a requirements-only project. |
| `recognizedFiles` | Allowlisted root-level file names and categories | `inspected` only for the active manifest; all other recognized files are `detected-only`. |
| `packageManagerEvidence` | Recognized npm/pnpm/Yarn/Bun lockfiles | Evidence of a lockfile, **not** the active package manager or an error. |
| `workspaceMarkers` | Root-level files like `pnpm-workspace.yaml` and `go.work` | Marker presence only, not parsed workspace membership. |
| `commonDirectories` | Selected root-level directories such as `src` and `tests` | Directory-name presence only, not content analysis. |

The `InspectionSection` discriminated union contains validated ecosystem-specific data. `src/inspection.ts` re-exports the type from `src/project.ts`.

**The difference between detection and inspection is foundational.** Finding `tsconfig.json` does not prove its contents are valid. Finding `yarn.lock` does not prove Yarn is the active package manager. Finding `src/` does not prove a source file was analyzed. Finding no diagnostics does not mean the project is healthy.

## Summary and CLI reporting

`summarizeInspection(result)` in `src/summary.ts` derives `InspectionSummary` from the detection list, coverage records, and diagnostic severities. `ecosystemsInspected` is the sum of `basic` and `limited` coverage counts. `coverageCounts` and `diagnosticCounts` include zeroes for levels and severities with no entries. The function is pure and usable by any consumer of `InspectionResult`.

`src/index.ts` validates arguments before inspection. A single path is optional and defaults to `.`. `--brief` can appear on either side of the path. Valid `--help` and `--version` invocations exit before project discovery. Argument errors and failed filesystem or manifest validation exit with status `1`.

`src/terminal.ts` renders the summary and coverage in both report modes. The standard report includes Project Explorer and ecosystem-specific manifest details. The brief report uses the shared project identities and omits the file inventory and manifest details. Both modes preserve the diagnostic identifiers, messages, recommendations, and coverage details. When there is no supported ecosystem to inspect, the CLI prints the available discovery and coverage data and exits with status `1`.

## Design and security boundaries

- **No inspected-project execution.** Never execute scripts, import target config files, spawn their build processes, or install dependencies while inspecting.
- **Offline-first.** The inspection engine makes no network requests.
- **Root-only discovery.** `readdir` does not traverse subdirectories. The Explorer ignores symbolic-link entries, and only records known names rather than printing a raw inventory. This is *not* a full filesystem security sandbox; inspected manifest reads still use the normal filesystem and can be affected by concurrent filesystem changes.
- **Untrusted content.** Supported manifests are runtime validated before being represented as project identity. Their contents can still be malicious or huge, so future work should consider explicit resource limits and careful input-size handling.
- **Terminal safety.** Each dynamic terminal line, including errors, replaces control characters, Unicode line separators, and bidirectional controls with spaces. The programmatic API retains the original data.
- **Validation versus advice.** Malformed supported metadata throws and leads to a CLI failure. Missing recommended fields yield nonfatal diagnostics.
- **Coverage honesty.** `basic`, `limited`, and `detected-only` are distinct; the CLI cannot claim that unimplemented checks passed.

## Extension workflow

### Adding a recognized root-level file

Extend the allowlist in `src/project.ts` and classify it accurately. The default status is `detected-only`; do not mark it `inspected` unless the inspection engine actually validates its contents. Add a unit test confirming that the file is discovered without being executed or parsed.

### Adding a new ecosystem inspector

1. Add supported file-name signals to `src/detect.ts` without opening or running them.
2. Create a typed, runtime-validating inspector in `src/inspectors/`.
3. Extend the `InspectionSection` union in `src/project.ts`.
4. Add an identity mapping in `buildProjectOverview()` and orchestration logic in `src/inspection.ts`.
5. Add health diagnostics only when enough validated data exists to support them.
6. Add exact coverage statements and a terminal rendering branch; TypeScript's exhaustive switches will flag missing sections.
7. Add fixtures, unit tests, CLI regression tests, and error-path tests.

### Adding a Health Doctor rule

Keep the diagnostic separate from presentation. Give it a stable `PI-...` code, an accurate severity, a bounded explanation, and a next step that does not overstate certainty. Avoid misleading conclusions from absence of evidence. Test both triggering and non-triggering cases.

## Compatibility rules

- Preserve `inspectProject(projectPath)` and all its result fields (`projectPath`, `detectedEcosystems`, `overview`, `sections`, `diagnostics`, and `coverage`).
- Keep `getNodeHealthDiagnostics()`, `getPythonHealthDiagnostics()`, and `getRequirementsHealthDiagnostics()` unchanged unless deliberately upgrading their contracts.
- Retain the CLI's existing `Detected Project`, `Health Checks`, and `Inspection Coverage` conventions for current users.
- Keep `0.1.0` until a reviewed release decision. Do not change the PolyForm Perimeter 1.0.1 license.
