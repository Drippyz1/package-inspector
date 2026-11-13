import type { Dirent } from "node:fs";
import type { PackageData } from "./inspectors/node.js";
import type { PythonProjectData } from "./inspectors/python.js";
import type { RequirementsSummary } from "./inspectors/requirements.js";

/** The existing ecosystem-specific inspection output remains lossless. */
export type InspectionSection =
    | { kind: "node"; data: PackageData }
    | { kind: "python"; data: PythonProjectData }
    | { kind: "requirements"; data: RequirementsSummary };

export type ProjectIdentity = {
    ecosystem: "JavaScript / TypeScript" | "Python";
    manifest: "package.json" | "pyproject.toml" | "requirements.txt";
    name?: string;
    version?: string;
    versionStatus: "declared" | "dynamic" | "unavailable";
    description?: string;
};

export type RecognizedFile = {
    path: string;
    category: "manifest" | "configuration" | "lockfile" | "workspace" | "documentation";
    /** Only metadata actively parsed by an inspector is marked inspected. */
    status: "inspected" | "detected-only";
};

export type PackageManagerEvidence = {
    manager: "npm" | "pnpm" | "Yarn" | "Bun";
    file: string;
};

/** Root-level discovery facts. This is not a recursive project inventory. */
export type ProjectOverview = {
    scope: "project-root";
    identities: ProjectIdentity[];
    recognizedFiles: RecognizedFile[];
    packageManagerEvidence: PackageManagerEvidence[];
    workspaceMarkers: string[];
    commonDirectories: string[];
};

export type RootEntries = {
    files: ReadonlySet<string>;
    directories: ReadonlySet<string>;
};

/** Ignore symbolic links: we don't traverse them or trust their targets. */
export function indexRootEntries(entries: readonly Dirent[]): RootEntries {
    const files = new Set<string>();
    const directories = new Set<string>();

    for (const entry of entries) {
        if (entry.isFile()) {
            files.add(entry.name);
        } else if (entry.isDirectory()) {
            directories.add(entry.name);
        }
    }

    return { files, directories };
}

/** Allowlisted project-root signals; presence is not equivalent to validation. */
const RECOGNIZED_FILES: Readonly<Record<string, RecognizedFile["category"]>> = {
    "package.json": "manifest",
    "pyproject.toml": "manifest",
    "requirements.txt": "manifest",
    "Cargo.toml": "manifest",
    "go.mod": "manifest",
    "pom.xml": "manifest",
    "build.gradle": "manifest",
    "build.gradle.kts": "manifest",
    "settings.gradle": "configuration",
    "settings.gradle.kts": "configuration",
    "tsconfig.json": "configuration",
    "jsconfig.json": "configuration",
    "vite.config.ts": "configuration",
    "vite.config.js": "configuration",
    "vitest.config.ts": "configuration",
    "vitest.config.js": "configuration",
    "next.config.js": "configuration",
    "next.config.mjs": "configuration",
    "next.config.ts": "configuration",
    "eslint.config.js": "configuration",
    "eslint.config.mjs": "configuration",
    "eslint.config.cjs": "configuration",
    "eslint.config.ts": "configuration",
    ".eslintrc.json": "configuration",
    ".prettierrc": "configuration",
    ".prettierrc.json": "configuration",
    "pytest.ini": "configuration",
    "tox.ini": "configuration",
    "ruff.toml": "configuration",
    ".ruff.toml": "configuration",
    "gradle.properties": "configuration",
    "go.work": "workspace",
    "pnpm-workspace.yaml": "workspace",
    "lerna.json": "workspace",
    "nx.json": "workspace",
    "turbo.json": "workspace",
    "rush.json": "workspace",
    "package-lock.json": "lockfile",
    "npm-shrinkwrap.json": "lockfile",
    "pnpm-lock.yaml": "lockfile",
    "yarn.lock": "lockfile",
    "bun.lock": "lockfile",
    "bun.lockb": "lockfile",
    "poetry.lock": "lockfile",
    "uv.lock": "lockfile",
    "Pipfile.lock": "lockfile",
    "Cargo.lock": "lockfile",
    "go.sum": "lockfile",
    "README.md": "documentation",
    "README.rst": "documentation",
    "README.txt": "documentation",
    "LICENSE": "documentation",
    "CONTRIBUTING.md": "documentation"
};

const NODE_PACKAGE_MANAGER_FILES: Readonly<Record<string, PackageManagerEvidence["manager"]>> = {
    "package-lock.json": "npm",
    "npm-shrinkwrap.json": "npm",
    "pnpm-lock.yaml": "pnpm",
    "yarn.lock": "Yarn",
    "bun.lock": "Bun",
    "bun.lockb": "Bun"
};

const COMMON_DIRECTORIES = new Set([
    ".github", "api", "app", "apps", "backend", "client", "cmd", "components",
    "docs", "frontend", "internal", "lib", "libs", "pages", "packages", "pkg",
    "public", "scripts", "server", "src", "test", "tests", "web"
]);

/**
 * Produce one shared, conservative overview from already-validated metadata
 * and a single, non-recursive directory listing. No extra files are parsed.
 */
export function buildProjectOverview(
    root: RootEntries,
    sections: readonly InspectionSection[]
): ProjectOverview {
    const identities: ProjectIdentity[] = sections.map((section): ProjectIdentity => {
        switch (section.kind) {
            case "node":
                return {
                    ecosystem: "JavaScript / TypeScript",
                    manifest: "package.json",
                    name: section.data.name,
                    version: section.data.version,
                    versionStatus: "declared",
                    description: section.data.description
                };
            case "python":
                return {
                    ecosystem: "Python",
                    manifest: "pyproject.toml",
                    name: section.data.name,
                    version: section.data.version,
                    versionStatus: section.data.dynamicVersion ? "dynamic" : "declared",
                    description: section.data.description
                };
            case "requirements":
                return {
                    ecosystem: "Python",
                    manifest: "requirements.txt",
                    versionStatus: "unavailable"
                };
            default: {
                const exhaustive: never = section;
                throw new Error(`Unsupported section: ${String(exhaustive)}`);
            }
        }
    });

    const inspectedFiles = new Set<string>(identities.map((identity) => identity.manifest));
    const recognizedFiles = Array.from(root.files)
        .filter((name) => Object.hasOwn(RECOGNIZED_FILES, name))
        .sort((a, b) => a.localeCompare(b, "en"))
        .map((name): RecognizedFile => ({
            path: name,
            category: RECOGNIZED_FILES[name],
            status: inspectedFiles.has(name) ? "inspected" : "detected-only"
        }));

    const packageManagerEvidence = recognizedFiles
        .filter((file) => Object.hasOwn(NODE_PACKAGE_MANAGER_FILES, file.path))
        .map((file): PackageManagerEvidence => ({
            manager: NODE_PACKAGE_MANAGER_FILES[file.path],
            file: file.path
        }));

    const workspaceMarkers = recognizedFiles
        .filter((file) => file.category === "workspace")
        .map((file) => file.path);

    const commonDirectories = Array.from(root.directories)
        .filter((name) => COMMON_DIRECTORIES.has(name))
        .sort((a, b) => a.localeCompare(b, "en"));

    return {
        scope: "project-root",
        identities,
        recognizedFiles,
        packageManagerEvidence,
        workspaceMarkers,
        commonDirectories
    };
}
