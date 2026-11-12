import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";

export type PythonProjectData = {
    name: string;
    version?: string;
    description?: string;
    requiresPython?: string;
    dependencies: string[];
    dynamicVersion: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function optionalText(value: unknown, label: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value !== "string") {
        throw new Error(label + " must be text.");
    }

    return value;
}

export async function inspectPythonProject(
    projectPath: string
): Promise<PythonProjectData> {
    const filePath = join(projectPath, "pyproject.toml");
    const contents = await readFile(filePath, "utf8");

    const document: unknown = parse(contents);

    if (!isRecord(document) || !isRecord(document.project)) {
        throw new Error(
            "Python inspection currently requires a [project] section in pyproject.toml."
        );
    }

    const project = document.project;

    if (typeof project.name !== "string" || !project.name.trim()) {
        throw new Error("Python project name must be non-empty text.");
    }

    const version = optionalText(project.version, "Python project version");
    const description = optionalText(project.description, "Python project description");
    const requiresPython = optionalText(
        project["requires-python"],
        "Python version requirement"
    );

    const dynamic = project.dynamic;

    if (
        dynamic !== undefined &&
        (
            !Array.isArray(dynamic) ||
            !dynamic.every((item) => typeof item === "string")
        )
    ) {
        throw new Error("Python dynamic fields must be an array of strings.");
    }

    const dynamicVersion = Array.isArray(dynamic) && dynamic.includes("version");

    if (version === undefined && !dynamicVersion) {
        throw new Error("Python project version must be specified or declared dynamic.");
    }

    if (version !== undefined && dynamicVersion) {
        throw new Error("Python project version cannot be both static and dynamic.");
    }

    const dependencies = project.dependencies;

    if (
        dependencies !== undefined &&
        (
            !Array.isArray(dependencies) ||
            !dependencies.every(
                (dependency) => typeof dependency === "string"
            )
        )
    ) {
        throw new Error("Python dependencies must be an array of strings.");
    }

    return {
        name: project.name,
        version,
        description,
        requiresPython,
        dependencies: dependencies ?? [],
        dynamicVersion
    };
}