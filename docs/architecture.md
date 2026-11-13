# Package Inspector architecture

> Architecture checkpoint: Sprint #9. Package Inspector remains version `0.1.0`; the broader Project Explorer and Health Doctor roadmap is not yet fully implemented.

## Purpose

The tool answers two separate questions about a local project:

1. **Explorer:** Which ecosystem manifests, documentation files, recognized configuration files, package-manager lockfiles, and common directories can we identify *without executing the project*?
2. **Health Doctor:** Based on metadata we actually parsed and validated, which limited, actionable recommendations can we support with evidence?

These questions share discovery and validated metadata. They must not become duplicate scanners or contradictory sources of truth.

## Data flow

```text
Path argument
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
    v
terminal.ts (CLI presentation) / future consumers
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

The raw `InspectionSection` discriminated union still contains ecosystem-specific validated data so future modules can access fields without losing information. It has moved to `src/project.ts`, with a re-export in `src/inspection.ts` to preserve the previous import path.

**The difference between detection and inspection is foundational.** Finding `tsconfig.json` does not prove its contents are valid. Finding `yarn.lock` does not prove Yarn is the active package manager. Finding `src/` does not prove a source file was analyzed. Finding no diagnostics does not mean the project is healthy.

## Design and security boundaries

- **No inspected-project execution.** Never execute scripts, import target config files, spawn their build processes, or install dependencies while inspecting.
- **Offline-first.** The inspection engine makes no network requests.
- **Root-only discovery.** `readdir` does not traverse subdirectories. The Explorer ignores symbolic-link entries, and only records known names rather than printing a raw inventory. This is *not* a full filesystem security sandbox; inspected manifest reads still use the normal filesystem and can be affected by concurrent filesystem changes.
- **Untrusted content.** Supported manifests are runtime validated before being represented as project identity. Their contents can still be malicious or huge, so future work should consider explicit resource limits and careful input-size handling.
- **Terminal safety.** Displayed project strings are sanitized to strip terminal control characters and common Unicode bidirectional controls. Data in the programmatic API is not modified for display.
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

- Preserve the `inspectProject(projectPath)` function and existing result fields (`projectPath`, `detectedEcosystems`, `sections`, `diagnostics`, `coverage`); Sprint #9 adds `overview`.
- Keep `getNodeHealthDiagnostics()`, `getPythonHealthDiagnostics()`, and `getRequirementsHealthDiagnostics()` unchanged unless deliberately upgrading their contracts.
- Retain the CLI's existing `Detected Project`, `Health Checks`, and `Inspection Coverage` conventions for current users.
- Keep `0.1.0` until a reviewed release decision. Do not change the PolyForm Perimeter 1.0.1 license.

## Next milestone

Sprint #10 can improve terminal presentation, filtering, and inspection-coverage summaries using the shared result model. Broader framework and workspace analysis should follow only when we can validate it correctly. A full plugin system, arbitrary project execution, and speculative health scores are intentionally out of scope.
