import { inspectProject } from "./inspection.js";
import {
    printDetectedEcosystems,
    printInspectionReport,
    printProjectOverview,
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
        // Even detection-only projects can show useful, honest discovery facts.
        printProjectOverview(result.overview);
        throw new Error(
            "Full inspection currently supports JavaScript/TypeScript and Python projects only."
        );
    }

    printInspectionReport(result);
} catch (error) {
    console.error("Inspection Failed: " + String(error));
    process.exitCode = 1;
}
