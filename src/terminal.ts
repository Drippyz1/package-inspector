import type { Ecosystem } from "./detect.js";
import type { Diagnostic } from "./diagnostics.js";
import type {
    InspectionCoverage,
    InspectionResult,
    InspectionSection
} from "./inspection.js";
import type { ProjectOverview } from "./project.js";

const APP_NAME = "Package Inspector";
const APP_VERSION = "0.1.0";

/** Neutralize terminal control characters from untrusted project metadata. */
function safeText(value: string): string {
    return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ");
}

export function printWelcome(): void {
    console.log(APP_NAME);
    console.log("Version: " + APP_VERSION);
    console.log("Description: A tool for inspecting software projects");
}

export function printSelectedFolder(projectPath: string): void {
    console.log("Selected folder: " + safeText(projectPath));
}

export function printDetectedEcosystems(ecosystems: Ecosystem[]): void {
    console.log(
        "Detected Ecosystems: " +
        (ecosystems.length === 0 ? "Unknown" : ecosystems.join(", "))
    );
}

/** Explorer facts are deliberately distinct from validated inspection results. */
export function printProjectOverview(overview: ProjectOverview): void {
    console.log("Project Explorer:");
    console.log("  Discovery Scope: Project root only (no recursive scanning)");

    console.log("  Project Identities:");
    if (overview.identities.length === 0) {
        console.log("  - No supported project metadata inspected.");
    }
    for (const identity of overview.identities) {
        const name = identity.name === undefined ? "Metadata unavailable" : safeText(identity.name);
        const version = identity.versionStatus === "dynamic"
            ? "Dynamic version"
            : identity.versionStatus === "unavailable"
                ? "Version unavailable"
                : `v${safeText(identity.version ?? "")}`;
        console.log(`  - ${identity.ecosystem}: ${name} (${version}; ${identity.manifest})`);
    }

    console.log("  Recognized Files:");
    if (overview.recognizedFiles.length === 0) {
        console.log("  - None from the current root-level allowlist.");
    }
    for (const file of overview.recognizedFiles) {
        console.log(`  - ${file.path} [${file.category}, ${file.status}]`);
    }

    const managers = overview.packageManagerEvidence.map(
        (signal) => `${signal.manager} (${signal.file})`
    );
    console.log("  Package Manager Evidence: " +
        (managers.length === 0 ? "None detected" : managers.join(", ")));
    console.log("  Workspace Markers: " +
        (overview.workspaceMarkers.length === 0 ? "None detected" : overview.workspaceMarkers.join(", ")));
    console.log("  Common Directories: " +
        (overview.commonDirectories.length === 0 ? "None detected" : overview.commonDirectories.join(", ")));
}

function printSection(section: InspectionSection): void {
    switch (section.kind) {
        case "node": {
            const project = section.data;
            const dependencyCount = Object.keys(project.dependencies ?? {}).length;
            const devDependencyCount = Object.keys(project.devDependencies ?? {}).length;
            const scriptNames = Object.keys(project.scripts ?? {});

            console.log("Detected Project: " + safeText(project.name));
            console.log("Detected Version: " + safeText(project.version));
            console.log("Description: " + safeText(project.description ?? "Not Available"));
            console.log("Dependencies: " + dependencyCount);
            console.log("Development Dependencies: " + devDependencyCount);
            console.log("Development Script: " + safeText(project.scripts?.dev ?? "Not Available"));
            console.log(
                "Available Scripts: " +
                (scriptNames.length === 0 ? "None" : scriptNames.map(safeText).join(", "))
            );
            break;
        }
        case "python": {
            const project = section.data;
            console.log("Detected Python Project: " + safeText(project.name));
            console.log(
                "Version: " +
                safeText(project.version ?? (project.dynamicVersion ? "Dynamic" : "Not Available"))
            );
            console.log("Description: " + safeText(project.description ?? "Not Available"));
            console.log("Requires Python: " + safeText(project.requiresPython ?? "Not Specified"));
            console.log("Python Dependencies: " + project.dependencies.length);
            break;
        }
        case "requirements": {
            const summary = section.data;
            console.log("Python Configuration: requirements.txt");
            console.log("Inspection Mode: Limited");
            console.log("Project Metadata: Not available");
            console.log("Requirement Entries: " + summary.entries.length);
            console.log("Unprocessed Directives: " + summary.directives.length);
            break;
        }
        default: {
            const unhandled: never = section;
            throw new Error(`Unknown inspection section: ${String(unhandled)}`);
        }
    }
}

function printDiagnostics(diagnostics: Diagnostic[]): void {
    console.log("Health Checks:");
    if (diagnostics.length === 0) {
        console.log("[PASS] No basic warnings found.");
        return;
    }
    for (const diagnostic of diagnostics) {
        const tag = diagnostic.severity === "warning" ? "WARN" : "INFO";
        console.log(`[${tag}] [${diagnostic.code}] ${safeText(diagnostic.title)}`);
        console.log("  " + safeText(diagnostic.message));
        console.log("  Recommendation: " + safeText(diagnostic.recommendation));
    }
    console.log(
        "Total Warnings: " +
        diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
    );
}

function printCoverage(coverage: InspectionCoverage[]): void {
    console.log("Inspection Coverage:");
    for (const item of coverage) {
        console.log(`- ${item.ecosystem} [${item.level}]: ${safeText(item.details)}`);
    }
}

export function printInspectionReport(result: InspectionResult): void {
    printProjectOverview(result.overview);
    for (const section of result.sections) {
        printSection(section);
    }
    printDiagnostics(result.diagnostics);
    printCoverage(result.coverage);
}
