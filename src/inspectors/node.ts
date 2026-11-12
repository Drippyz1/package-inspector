import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PackageData = {
    name: string;
    version: string;
    description?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function validateDependencies(
    value: unknown,
    label: string
): asserts value is Record<string, string> | undefined {
    if (value === undefined) {
        return;
    }

    if (!isRecord(value)) {
        throw new Error(label + " must be an object.");
    }

    for (const [name, version] of Object.entries(value)) {
        if (typeof version !== "string") {
            throw new Error(name + " must have a text version.");
        }
    }
}

function validateScripts(
    value: unknown
): asserts value is Record<string, string> | undefined {
    if (value === undefined) {
        return;
    }

    if (!isRecord(value)) {
        throw new Error("Scripts must be an object.");
    }

    for (const [name, command] of Object.entries(value)) {
        if (typeof command !== "string") {
            throw new Error('Script "' + name + '" must be text.');
        }
    }
}

export async function inspectNodeProject(
    projectPath: string
): Promise<PackageData> {
    const filePath = join(projectPath, "package.json");
    const fileContents = await readFile(filePath, "utf8");

    const parsed: unknown = JSON.parse(fileContents);

    if (!isRecord(parsed)) {
        throw new Error("Package data must be an object.");
    }

    if (typeof parsed.name !== "string") {
        throw new Error("Project name must be text.");
    }

    if (typeof parsed.version !== "string") {
        throw new Error("Project version must be text.");
    }

    const packageData: PackageData = {
        name: parsed.name,
        version: parsed.version
    };

    if (parsed.description !== undefined) {
        if (typeof parsed.description !== "string") {
            throw new Error("Project description must be text.");
        }

        packageData.description = parsed.description;
    }

    validateDependencies(parsed.dependencies, "Dependencies");
    validateDependencies(parsed.devDependencies, "Development Dependencies");
    validateScripts(parsed.scripts);

    if (parsed.dependencies !== undefined) {
        packageData.dependencies = parsed.dependencies;
    }

    if (parsed.devDependencies !== undefined) {
        packageData.devDependencies = parsed.devDependencies;
    }

    if (parsed.scripts !== undefined) {
        packageData.scripts = parsed.scripts;
    }

    return packageData;
}