import { readdir } from "node:fs/promises";

export type Ecosystem =
    | "JavaScript / TypeScript"
    | "Python"
    | "Java / JVM"
    | "Rust"
    | "Go";

export async function detectEcosystems(
    projectPath: string
): Promise<Ecosystem[]> {
    const entries = await readdir(projectPath, { withFileTypes: true });
    const files = new Set(
        entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
    );
    return detectEcosystemsFromFiles(files);
}

/** Pure ecosystem detection, shared by the CLI and the inspection orchestrator. */
export function detectEcosystemsFromFiles(files: ReadonlySet<string>): Ecosystem[] {
    const ecosystems: Ecosystem[] = [];
    if (files.has("package.json")) {
        ecosystems.push("JavaScript / TypeScript");
    }
    if (files.has("pyproject.toml") || files.has("requirements.txt")) {
        ecosystems.push("Python");
    }
    if (files.has("build.gradle") || files.has("build.gradle.kts") || files.has("pom.xml")) {
        ecosystems.push("Java / JVM");
    }
    if (files.has("Cargo.toml")) {
        ecosystems.push("Rust");
    }
    if (files.has("go.mod")) {
        ecosystems.push("Go");
    }
    return ecosystems;
}
