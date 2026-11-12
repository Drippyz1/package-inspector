import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getHealthWarnings } from "./health.js";

type ProjectInfo = {
  name: string;
  version: string;
  description: string;
};

type PackageData = {
    name: string;
    version: string;
    description?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
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

function validateDependencies(value: unknown, label: string): void {
    if (
        value !== undefined &&
        (
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value)
        )
    ) {
        throw new Error(label + " must be an object.");
    }

    if (value !== undefined) {
        for (const [name, version] of Object.entries(value)) {

            if (typeof version !== "string") {
                throw new Error(name + " must have a text version.");
            }
        }    
    }
}

function validateScripts(value: unknown): void {
    if (value === undefined) {
        return;
    }

    if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
    ) {
        throw new Error("Scripts must be an object.");
    }

    for (const [name, command] of Object.entries(value)) {
        if (typeof command !== "string") {
            throw new Error('Script "' + name + '" must be text.');
        }
    }
}

function displayPackage(packageData: PackageData): void {

    const dependencyCount = Object.keys(packageData.dependencies ?? {}).length;

    const devDependencyCount = Object.keys(packageData.devDependencies ?? {}).length;

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

const packageFilePath = join(projectPath, "package.json");

console.log("Selected folder: " + projectPath);

try {
    const fileContents = await readFile(packageFilePath, "utf-8");

    const packageData = JSON.parse(fileContents);

    if (
        packageData === null ||
        typeof packageData !== "object" ||
        Array.isArray(packageData)
    ) {
        throw new Error("Package data must be an object.");
    }

    if (typeof packageData.name !== "string") {
        throw new Error("Project name must be text.");
    }

    if (typeof packageData.version !== "string") {
        throw new Error("Project version must be text.");
    }

    if (
        packageData.description !== undefined &&
        typeof packageData.description !== "string"
    ) {
        throw new Error("Project description must be text.");
    }

    validateDependencies(packageData.dependencies, "Dependencies");

    validateDependencies(packageData.devDependencies, "Development Dependencies");

    validateScripts(packageData.scripts);

    displayPackage(packageData);

    const warnings = getHealthWarnings(packageData);

    displayHealthWarnings(warnings);

} catch (error) {
    console.error("Inspection Failed: " + String(error));
    process.exitCode = 1;
}

