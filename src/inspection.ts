import { readdir } from "node:fs/promises";
import { detectEcosystemsFromFiles, type Ecosystem } from "./detect.js";
import type { Diagnostic } from "./diagnostics.js";
import {
    getNodeHealthDiagnostics,
    getPythonHealthDiagnostics,
    getRequirementsHealthDiagnostics
} from "./health.js";
import { inspectNodeProject } from "./inspectors/node.js";
import { inspectPythonProject } from "./inspectors/python.js";
import { inspectRequirementsFile } from "./inspectors/requirements.js";
import {
    buildProjectOverview,
    indexRootEntries,
    type InspectionSection,
    type ProjectOverview
} from "./project.js";

/** Retain the Sprint #8 public type import path. */
export type { InspectionSection } from "./project.js";

/** How deeply an ecosystem was inspected during this invocation. */
export type InspectionCoverage = {
    ecosystem: Ecosystem;
    level: "basic" | "limited" | "detected-only";
    details: string;
};

/** Result of inspecting a local folder; presentation is intentionally separate. */
export type InspectionResult = {
    projectPath: string;
    detectedEcosystems: Ecosystem[];
    overview: ProjectOverview;
    sections: InspectionSection[];
    diagnostics: Diagnostic[];
    coverage: InspectionCoverage[];
};

/**
 * Inspect the selected directory, never executing target project code.
 * The root is listed once. Supported manifests are validated before an
 * overview is produced; unrelated configuration files are only identified.
 *
 * Unsupported-only projects still return discovery facts for API consumers.
 * The CLI alone determines the unsupported-project exit code.
 */
export async function inspectProject(projectPath = "."): Promise<InspectionResult> {
    const root = indexRootEntries(await readdir(projectPath, { withFileTypes: true }));
    const detectedEcosystems = detectEcosystemsFromFiles(root.files);
    const sections: InspectionSection[] = [];
    const diagnostics: Diagnostic[] = [];
    const coverage: InspectionCoverage[] = [];

    if (detectedEcosystems.includes("JavaScript / TypeScript")) {
        const data = await inspectNodeProject(projectPath);
        sections.push({ kind: "node", data });
        diagnostics.push(...getNodeHealthDiagnostics(data));
    }

    if (detectedEcosystems.includes("Python")) {
        if (root.files.has("pyproject.toml")) {
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
            if (root.files.has("pyproject.toml")) {
                coverage.push({
                    ecosystem,
                    level: "basic",
                    details: "pyproject.toml [project] metadata and basic health checks only; no dependency resolution." +
                        (root.files.has("requirements.txt")
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
        overview: buildProjectOverview(root, sections),
        sections,
        diagnostics,
        coverage
    };
}
