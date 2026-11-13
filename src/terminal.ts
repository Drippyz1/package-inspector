import type { Ecosystem } from "./detect.js";
import type { Diagnostic } from "./diagnostics.js";
import type {
    InspectionCoverage,
    InspectionResult,
    InspectionSection
} from "./inspection.js";

const APP_NAME = "Package Inspector";
const APP_VERSION = "0.1.0";

export function printWelcome(): void {
    console.log(APP_NAME);
    console.log("Version: " + APP_VERSION);
    console.log("Description: A tool for inspecting software projects");
}

export function printSelectedFolder(projectPath: string): void {
    console.log("Selected folder: " + projectPath);
}

export function printDetectedEcosystems(ecosystems: Ecosystem[]): void {
    console.log(
        "Detected Ecosystems: " +
        (ecosystems.length === 0 ? "Unknown" : ecosystems.join(", "))
    );
}

function printSection(section: InspectionSection): void {
    switch (section.kind) {
        case "node": {
            const project = section.data;
            const dependencyCount = Object.keys(project.dependencies ?? {}).length;
            const devDependencyCount = Object.keys(project.devDependencies ?? {}).length;
            const scriptNames = Object.keys(project.scripts ?? {});

            console.log("Detected Project: " + project.name);
            console.log("Detected Version: " + project.version);
            console.log("Description: " + (project.description ?? "Not Available"));
            console.log("Dependencies: " + dependencyCount);
            console.log("Development Dependencies: " + devDependencyCount);
            console.log("Development Script: " + (project.scripts?.dev ?? "Not Available"));
            console.log(
                "Available Scripts: " +
                (scriptNames.length === 0 ? "None" : scriptNames.join(", "))
            );
            break;
        }
        case "python": {
            const project = section.data;
            console.log("Detected Python Project: " + project.name);
            console.log(
                "Version: " +
                (project.version ?? (project.dynamicVersion ? "Dynamic" : "Not Available"))
            );
            console.log("Description: " + (project.description ?? "Not Available"));
            console.log("Requires Python: " + (project.requiresPython ?? "Not Specified"));
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
            // Make new section kinds an explicit compiler-checked rendering decision.
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
        console.log(`[${tag}] [${diagnostic.code}] ${diagnostic.title}`);
        console.log("  " + diagnostic.message);
        console.log("  Recommendation: " + diagnostic.recommendation);
    }

    console.log(
        "Total Warnings: " +
        diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length
    );
}

function printCoverage(coverage: InspectionCoverage[]): void {
    console.log("Inspection Coverage:");

    for (const item of coverage) {
        console.log(`- ${item.ecosystem} [${item.level}]: ${item.details}`);
    }
}

export function printInspectionReport(result: InspectionResult): void {
    for (const section of result.sections) {
        printSection(section);
    }

    printDiagnostics(result.diagnostics);
    printCoverage(result.coverage);
}
