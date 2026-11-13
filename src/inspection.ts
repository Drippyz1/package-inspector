import { readdir } from "node:fs/promises";
import { detectEcosystems, type Ecosystem } from "./detect.js";
import type { Diagnostic } from "./diagnostics.js";
import {
    getNodeHealthDiagnostics,
    getPythonHealthDiagnostics,
    getRequirementsHealthDiagnostics
} from "./health.js";
import { inspectNodeProject, type PackageData } from "./inspectors/node.js";
import { inspectPythonProject, type PythonProjectData } from "./inspectors/python.js";
import {
    inspectRequirementsFile,
    type RequirementsSummary
} from "./inspectors/requirements.js";

/** How deeply an ecosystem was inspected during this invocation. */
export type InspectionCoverage = {
    ecosystem: Ecosystem;
    level: "basic" | "limited" | "detected-only";
    details: string;
};

/** Preserve ecosystem-specific data without forcing it into a lossy shared shape. */
export type InspectionSection =
    | { kind: "node"; data: PackageData }
    | { kind: "python"; data: PythonProjectData }
    | { kind: "requirements"; data: RequirementsSummary };

/** Result of inspecting a local folder; presentation is intentionally separate. */
export type InspectionResult = {
    projectPath: string;
    detectedEcosystems: Ecosystem[];
    sections: InspectionSection[];
    diagnostics: Diagnostic[];
    coverage: InspectionCoverage[];
};

/**
 * Read and assess project metadata without executing the project's code,
 * installing dependencies, or reaching out to remote services.
 *
 * An unsupported-only folder still returns detection and coverage details.
 * The CLI decides whether that is an unsuccessful command; other consumers
 * can display partial discovery results. Invalid metadata still throws.
 */
export async function inspectProject(projectPath = "."): Promise<InspectionResult> {
    const detectedEcosystems = await detectEcosystems(projectPath);
    const sections: InspectionSection[] = [];
    const diagnostics: Diagnostic[] = [];
    const coverage: InspectionCoverage[] = [];

    // Currently each ecosystem has one preferred metadata entry point.
    // A future discovery milestone will inspect multiple configurations.
    let pythonFiles = new Set<string>();
    if (detectedEcosystems.includes("Python")) {
        const entries = await readdir(projectPath, { withFileTypes: true });
        pythonFiles = new Set(
            entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
        );
    }

    if (detectedEcosystems.includes("JavaScript / TypeScript")) {
        const data = await inspectNodeProject(projectPath);
        sections.push({ kind: "node", data });
        diagnostics.push(...getNodeHealthDiagnostics(data));
    }

    if (detectedEcosystems.includes("Python")) {
        if (pythonFiles.has("pyproject.toml")) {
            const data = await inspectPythonProject(projectPath);
            sections.push({ kind: "python", data });
            diagnostics.push(...getPythonHealthDiagnostics(data));
        } else {
            const data = await inspectRequirementsFile(projectPath);
            sections.push({ kind: "requirements", data });
            diagnostics.push(...getRequirementsHealthDiagnostics(data));
        }
    }

    for (const ecosystem of detectedEcosystems) {
        if (ecosystem === "JavaScript / TypeScript") {
            coverage.push({
                ecosystem,
                level: "basic",
                details: "package.json metadata and basic health checks only; no script execution, dependency resolution, or vulnerability audit."
            });
        } else if (ecosystem === "Python") {
            if (pythonFiles.has("pyproject.toml")) {
                coverage.push({
                    ecosystem,
                    level: "basic",
                    details: "pyproject.toml [project] metadata and basic health checks only; no dependency resolution." +
                        (pythonFiles.has("requirements.txt")
                            ? " requirements.txt was not inspected."
                            : "")
                });
            } else {
                coverage.push({
                    ecosystem,
                    level: "limited",
                    details: "requirements.txt entries counted; directives, includes, and package versions were not resolved."
                });
            }
        } else {
            coverage.push({
                ecosystem,
                level: "detected-only",
                details: "Project files detected; no inspection rules are implemented for this ecosystem yet."
            });
        }
    }

    return {
        projectPath,
        detectedEcosystems,
        sections,
        diagnostics,
        coverage
    };
}
