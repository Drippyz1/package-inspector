import type { Ecosystem } from "./detect.js";
import type { Diagnostic } from "./diagnostics.js";
import type {
    InspectionCoverage,
    InspectionResult,
    InspectionSection
} from "./inspection.js";
import type { ProjectIdentity, ProjectOverview } from "./project.js";
import { summarizeInspection, type InspectionSummary } from "./summary.js";

const APP_NAME = "Package Inspector";
const APP_VERSION = "0.1.0";
const DISCOVERY_SCOPE = "Discovery Scope: Project root only (no recursive scanning)";

/** Keep untrusted text on one line and neutralize terminal and bidi controls. */
function safeText(value: string): string {
    return value.replace(/[\p{Cc}\u2028\u2029\p{Bidi_Control}]/gu, " ");
}

function printLine(line: string): void {
    console.log(safeText(line));
}

export function printError(message: string): void {
    console.error(safeText(message));
}

export function printHelp(): void {
    console.log(`${APP_NAME}

Usage: node dist/index.js [options] [project-path]
       npm run dev -- [options] [project-path]

Options:
  --help     Show usage and exit.
  --version  Show the version and exit.
  --brief    Show identities, summary, diagnostics, and coverage.

The project path defaults to the current directory. Use -- before a path that starts with a dash.`);
}

export function printVersion(): void {
    printLine(APP_VERSION);
}

export function printWelcome(): void {
    printLine(APP_NAME);
    printLine("Version: " + APP_VERSION);
    printLine("Description: A tool for inspecting software projects");
}

export function printSelectedFolder(projectPath: string): void {
    printLine("Selected folder: " + projectPath);
}

export function printDetectedEcosystems(ecosystems: readonly Ecosystem[]): void {
    printLine(
        "Detected Ecosystems: " +
        (ecosystems.length === 0 ? "Unknown" : ecosystems.join(", "))
    );
}

function printProjectIdentities(identities: readonly ProjectIdentity[], indent = ""): void {
    printLine(`${indent}Project Identities:`);
    if (identities.length === 0) {
        printLine(`${indent}- No supported project metadata inspected.`);
    }
    for (const identity of identities) {
        const name = identity.name ?? "Metadata unavailable";
        const version = identity.versionStatus === "dynamic"
            ? "Dynamic version"
            : identity.versionStatus === "unavailable"
                ? "Version unavailable"
                : `v${identity.version ?? ""}`;
        printLine(`${indent}- ${identity.ecosystem}: ${name} (${version}; ${identity.manifest})`);
    }
}

/** Explorer facts are deliberately distinct from validated inspection results. */
export function printProjectOverview(overview: ProjectOverview): void {
    printLine("Project Explorer:");
    printLine(`  ${DISCOVERY_SCOPE}`);
    printProjectIdentities(overview.identities, "  ");

    printLine("  Recognized Files:");
    if (overview.recognizedFiles.length === 0) {
        printLine("  - None from the current root-level allowlist.");
    }
    for (const file of overview.recognizedFiles) {
        printLine(`  - ${file.path} [${file.category}, ${file.status}]`);
    }

    const managers = overview.packageManagerEvidence.map(
        (signal) => `${signal.manager} (${signal.file})`
    );
    printLine("  Package Manager Evidence: " +
        (managers.length === 0 ? "None detected" : managers.join(", ")));
    printLine("  Workspace Markers: " +
        (overview.workspaceMarkers.length === 0 ? "None detected" : overview.workspaceMarkers.join(", ")));
    printLine("  Common Directories: " +
        (overview.commonDirectories.length === 0 ? "None detected" : overview.commonDirectories.join(", ")));
}

function printInspectionSummary(summary: InspectionSummary): void {
    const { basic, limited, "detected-only": detectedOnly } = summary.coverageCounts;
    const { warning, info } = summary.diagnosticCounts;
    printLine("Inspection Summary:");
    printLine(`  Ecosystems Detected: ${summary.ecosystemsDetected}`);
    printLine(`  Ecosystems Inspected: ${summary.ecosystemsInspected}`);
    printLine(`  Coverage: ${basic} basic, ${limited} limited, ${detectedOnly} detected-only`);
    printLine(`  Total Warnings: ${warning}`);
    printLine(`  Informational Diagnostics: ${info}`);
}

function printSection(section: InspectionSection): void {
    switch (section.kind) {
        case "node": {
            const project = section.data;
            const dependencyCount = Object.keys(project.dependencies ?? {}).length;
            const devDependencyCount = Object.keys(project.devDependencies ?? {}).length;
            const scriptNames = Object.keys(project.scripts ?? {});

            printLine("Detected Project: " + project.name);
            printLine("Detected Version: " + project.version);
            printLine("Description: " + (project.description ?? "Not Available"));
            printLine("Dependencies: " + dependencyCount);
            printLine("Development Dependencies: " + devDependencyCount);
            printLine("Development Script: " + (project.scripts?.dev ?? "Not Available"));
            printLine(
                "Available Scripts: " +
                (scriptNames.length === 0 ? "None" : scriptNames.join(", "))
            );
            break;
        }
        case "python": {
            const project = section.data;
            printLine("Detected Python Project: " + project.name);
            printLine(
                "Version: " +
                (project.version ?? (project.dynamicVersion ? "Dynamic" : "Not Available"))
            );
            printLine("Description: " + (project.description ?? "Not Available"));
            printLine("Requires Python: " + (project.requiresPython ?? "Not Specified"));
            printLine("Python Dependencies: " + project.dependencies.length);
            break;
        }
        case "requirements": {
            const summary = section.data;
            printLine("Python Configuration: requirements.txt");
            printLine("Inspection Mode: Limited");
            printLine("Project Metadata: Not available");
            printLine("Requirement Entries: " + summary.entries.length);
            printLine("Unprocessed Directives: " + summary.directives.length);
            break;
        }
        default: {
            const unhandled: never = section;
            throw new Error(`Unknown inspection section: ${String(unhandled)}`);
        }
    }
}

function printDiagnostics(diagnostics: readonly Diagnostic[]): void {
    printLine("Health Checks:");
    if (diagnostics.length === 0) {
        printLine("No basic warnings found. See inspection coverage for the scope of these checks.");
        return;
    }
    for (const diagnostic of diagnostics) {
        const tag = diagnostic.severity === "warning" ? "WARN" : "INFO";
        printLine(`[${tag}] [${diagnostic.code}] ${diagnostic.title}`);
        printLine("  " + diagnostic.message);
        printLine("  Recommendation: " + diagnostic.recommendation);
    }
}

function printCoverage(coverage: readonly InspectionCoverage[], showDiscoveryScope: boolean): void {
    printLine("Inspection Coverage:");
    if (showDiscoveryScope) {
        printLine(`  ${DISCOVERY_SCOPE}`);
    }
    if (coverage.length === 0) {
        printLine("- No ecosystems detected.");
    }
    for (const item of coverage) {
        printLine(`- ${item.ecosystem} [${item.level}]: ${item.details}`);
    }
}

export function printInspectionReport(result: InspectionResult, brief = false): void {
    const summary = summarizeInspection(result);
    if (brief) {
        printProjectIdentities(result.overview.identities);
        printInspectionSummary(summary);
    } else {
        printInspectionSummary(summary);
        printProjectOverview(result.overview);
        for (const section of result.sections) {
            printSection(section);
        }
    }
    if (summary.ecosystemsInspected > 0 || result.diagnostics.length > 0) {
        printDiagnostics(result.diagnostics);
    }
    printCoverage(result.coverage, brief);
}
