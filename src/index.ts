import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

function displayPackage(packageData: any): void {

    const dependencyCount = Object.keys(packageData.dependencies ?? {}).length;

    const devDependencyCount = Object.keys(packageData.devDependencies ?? {}).length;

    console.log("Detected Project: " + packageData.name);
    console.log("Detected Version: " + packageData.version);
    console.log("Description: " + (packageData.description ?? "Not Available"));
    console.log("Development Script: " + (packageData.scripts?.dev ?? "Not Available"));
    console.log("Dependencies: " + dependencyCount);
    console.log("Development Dependencies: " + devDependencyCount);
}

printWelcome(app);

const projectPath = process.argv[2] ?? ".";

const packageFilePath = join(projectPath, "package.json");

console.log("Selected folder: " + projectPath);

try {
    const fileContents = await readFile(packageFilePath, "utf-8");

    const packageData = JSON.parse(fileContents);

    if (typeof packageData.name !== "string") {
        throw new Error("Project name must be text.");
    }

    if (typeof packageData.version !== "string") {
        throw new Error("Project version must be text.");
    }

    displayPackage(packageData);

} catch (error) {
    console.error("Inspection Failed: " + String(error));
}

