import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type RequirementsSummary = {
    entries: string[];
    directives: string[];
};

export async function inspectRequirementsFile(
    projectPath: string
): Promise<RequirementsSummary> {
    const filePath = join(projectPath, "requirements.txt");
    const contents = await readFile(filePath, "utf8");

    const entries: string[] = [];
    const directives: string[] = [];

    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (line === "" || line.startsWith("#")) {
            continue;
        }

        if (line.startsWith("-")) {
            directives.push(line);
            continue;
        }

        entries.push(line);
    }

    return { entries, directives };
}
