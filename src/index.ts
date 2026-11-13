import { inspectProject } from "./inspection.js";
import {
    printDetectedEcosystems,
    printInspectionReport,
    printSelectedFolder,
    printWelcome
} from "./terminal.js";

const projectPath = process.argv[2] ?? ".";

printWelcome();
printSelectedFolder(projectPath);

try {
    const result = await inspectProject(projectPath);
    printDetectedEcosystems(result.detectedEcosystems);

    if (result.sections.length === 0) {
        throw new Error(
            "Full inspection currently supports JavaScript/TypeScript and Python projects only."
        );
    }

    printInspectionReport(result);
} catch (error) {
    console.error("Inspection Failed: " + String(error));
    process.exitCode = 1;
}
