import type { Diagnostic } from "./diagnostics.js";
import type { PackageData } from "./inspectors/node.js";
import type { PythonProjectData } from "./inspectors/python.js";
import type { RequirementsSummary } from "./inspectors/requirements.js";

/** Basic Node.js project recommendations; this is not a comprehensive audit. */
export function getNodeHealthDiagnostics(
    project: Pick<PackageData, "description" | "scripts">
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (!project.description?.trim()) {
        diagnostics.push({
            code: "PI-NODE-001",
            severity: "warning",
            title: "Project description is missing",
            message: "Project description is missing. New contributors may have difficulty understanding its purpose.",
            recommendation: "Consider adding a description to package.json so others can understand the project."
        });
    }

    if (!project.scripts?.test?.trim()) {
        diagnostics.push({
            code: "PI-NODE-002",
            severity: "warning",
            title: "No test script is configured",
            message: "No test script is configured. This does not necessarily mean the project has no tests.",
            recommendation: "Add an npm test script or document the existing test workflow if one is used."
        });
    }

    return diagnostics;
}

/** Basic PEP 621 project metadata recommendations. */
export function getPythonHealthDiagnostics(
    project: Pick<PythonProjectData, "description" | "requiresPython">
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (!project.description?.trim()) {
        diagnostics.push({
            code: "PI-PY-001",
            severity: "warning",
            title: "Python project description is missing",
            message: "Python project description is missing. New contributors may have difficulty understanding its purpose.",
            recommendation: "Consider adding a description under [project] in pyproject.toml."
        });
    }

    if (!project.requiresPython?.trim()) {
        diagnostics.push({
            code: "PI-PY-002",
            severity: "warning",
            title: "Supported Python versions are not specified",
            message: "Supported Python versions are not specified. Runtime compatibility expectations may be unclear.",
            recommendation: "Consider adding requires-python under [project] in pyproject.toml."
        });
    }

    return diagnostics;
}

/** Acknowledge requirements directives that the limited parser does not follow. */
export function getRequirementsHealthDiagnostics(
    requirements: Pick<RequirementsSummary, "directives">
): Diagnostic[] {
    if (requirements.directives.length === 0) {
        return [];
    }

    return [{
        code: "PI-REQ-001",
        severity: "warning",
        title: "Requirements directives were not expanded",
        message: "Requirements directives were not expanded. Referenced files and options may affect the actual dependency set.",
        recommendation: "Review the directives in requirements.txt manually; included files and options are not resolved."
    }];
}
