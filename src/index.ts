import { readdir } from "node:fs/promises";
import {
    inspectRequirementsFile,
    type RequirementsSummary
} from "./inspectors/requirements.js";
import { detectEcosystems } from "./detect.js";
import { getHealthWarnings, getPythonHealthWarnings } from "./health.js";
import { inspectNodeProject, type PackageData } from "./inspectors/node.js";
import {
    inspectPythonProject,
    type PythonProjectData
} from "./inspectors/python.js";

type ProjectInfo = {
    name: string;
    version: string;
    description: string;
};

const app: ProjectInfo = {
    name: "Package Inspector",
    version: "0.1.0",
    description: "A tool for inspecting software projects"
};

function printWelcome(project: ProjectInfo): void {
    console.log(project.name);
    console.log("Version: " + project.version);
    console.log("Description: " + project.description);
}

function displayPackage(packageData: PackageData): void {
    const dependencyCount = Object.keys(
        packageData.dependencies ?? {}
    ).length;

    const devDependencyCount = Object.keys(
        packageData.devDependencies ?? {}
    ).length;

    const scriptNames = Object.keys(packageData.scripts ?? {});

    console.log("Detected Project: " + packageData.name);
    console.log("Detected Version: " + packageData.version);
    console.log("Description: " + (packageData.description ?? "Not Available"));
    console.log("Dependencies: " + dependencyCount);
    console.log("Development Dependencies: " + devDependencyCount);
    console.log("Development Script: " + (packageData.scripts?.dev ?? "Not Available"));
    console.log(
        "Available Scripts: " +
        (scriptNames.length === 0 ? "None" : scriptNames.join(", "))
    );
}

function displayPythonProject(project: PythonProjectData): void {
    console.log("Detected Python Project: " + project.name);
    console.log(
        "Version: " +
        (project.version ?? (project.dynamicVersion ? "Dynamic" : "Not Available"))
    );
    console.log("Description: " + (project.description ?? "Not Available"));
    console.log("Requires Python: " + (project.requiresPython ?? "Not Specified"));
    console.log("Python Dependencies: " + project.dependencies.length);
}

function displayRequirements(summary: RequirementsSummary): void {
    console.log("Python Configuration: requirements.txt");
    console.log("Inspection Mode: Limited");
    console.log("Project Metadata: Not available");
    console.log("Requirement Entries: " + summary.entries.length);
    console.log("Unprocessed Directives: " + summary.directives.length);
}

function displayHealthWarnings(warnings: string[]): void {
    console.log("Health Checks:");

    if (warnings.length === 0) {
        console.log("[PASS] No basic warnings found.");
        return;
    }

    for (const warning of warnings) {
        console.log("[WARN] " + warning);
    }

    console.log("Total Warnings: " + warnings.length);
}

printWelcome(app);

const projectPath = process.argv[2] ?? ".";

console.log("Selected folder: " + projectPath);

try {
    const ecosystems = await detectEcosystems(projectPath);

    console.log(
        "Detected Ecosystems: " +
        (ecosystems.length === 0 ? "Unknown" : ecosystems.join(", "))
    );

    const hasNode = ecosystems.includes("JavaScript / TypeScript");
    const hasPython = ecosystems.includes("Python");

    if (!hasNode && !hasPython) {
        throw new Error(
            "Full inspection currently supports JavaScript/TypeScript and Python projects only."
        );
    }

    if (hasNode) {
        const packageData = await inspectNodeProject(projectPath);

        displayPackage(packageData);
        displayHealthWarnings(getHealthWarnings(packageData));
    }
    
    if (hasPython) {
        const files = await readdir(projectPath, {
            withFileTypes: true
        });

        const hasPyproject = files.some(
            (file) => file.isFile() && file.name === "pyproject.toml"
        );

        if (hasPyproject) {
            const pythonData = await inspectPythonProject(projectPath);

            displayPythonProject(pythonData);
            displayHealthWarnings(getPythonHealthWarnings(pythonData));
        } else {
            const requirements = await inspectRequirementsFile(projectPath);

            displayRequirements(requirements);

            const warnings: string[] = [];

            if (requirements.directives.length > 0) {
                warnings.push("Requirements directives were not expanded.");
            }

            displayHealthWarnings(warnings);
        }
    }

} catch (error) {
    console.error("Inspection Failed: " + String(error));
    process.exitCode = 1;
}