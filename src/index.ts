import { parseArgs } from "node:util";
import { inspectProject } from "./inspection.js";
import {
    printDetectedEcosystems,
    printError,
    printHelp,
    printInspectionReport,
    printSelectedFolder,
    printVersion,
    printWelcome
} from "./terminal.js";

async function main(): Promise<void> {
    let args;
    try {
        args = parseArgs({
            options: {
                help: { type: "boolean" },
                version: { type: "boolean" },
                brief: { type: "boolean" }
            },
            allowPositionals: true
        });
        if (args.positionals.length > 1) {
            throw new Error("Expected at most one project path.");
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        printError(`Argument Error: ${message} Run with --help for usage.`);
        process.exitCode = 1;
        return;
    }

    const { values, positionals } = args;
    if (values.help) {
        printHelp();
        return;
    }
    if (values.version) {
        printVersion();
        return;
    }

    const projectPath = positionals[0] ?? ".";
    const brief = values.brief ?? false;
    if (!brief) {
        printWelcome();
    }
    printSelectedFolder(projectPath);

    try {
        const result = await inspectProject(projectPath);
        if (!brief) {
            printDetectedEcosystems(result.detectedEcosystems);
        }
        printInspectionReport(result, brief);

        if (result.sections.length === 0) {
            throw new Error(
                "Full inspection currently supports JavaScript/TypeScript and Python projects only."
            );
        }
    } catch (error) {
        printError("Inspection Failed: " + String(error));
        process.exitCode = 1;
    }
}

await main();
