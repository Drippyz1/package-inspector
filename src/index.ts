import { detectEcosystems } from "./detect.js";
import { getHealthWarnings } from "./health.js";
import { inspectNodeProject, type PackageData } from "./inspectors/node.js";

type ProjectInfo = {
    name: string;
    version: string;
    description: string;
};

const app: ProjectInfo = {
    name: "Package Inspector",
    version: "0.1.0",
    description: "A tool for inspecting JavaScript projects"
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

    if (!ecosystems.includes("JavaScript / TypeScript")) {
        throw new Error(
            "Full inspection currently supports JavaScript/TypeScript projects only."
        );
    }

    const packageData = await inspectNodeProject(projectPath);

    displayPackage(packageData);

    const warnings = getHealthWarnings(packageData);

    displayHealthWarnings(warnings);
} catch (error) {
    console.error("Inspection Failed: " + String(error));
    process.exitCode = 1;
}