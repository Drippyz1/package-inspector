type ProjectHealthInput = {
    description?: string;
    scripts?: Record<string, string>;
};

export function getHealthWarnings(project: ProjectHealthInput): string[] {
    const warnings: string[] = [];

    if (!project.description?.trim()) {
        warnings.push("Project description is missing.");
    }

    if (!project.scripts?.test?.trim()) {
        warnings.push("No test script is configured.");
    }

    return warnings;
}

export function getPythonHealthWarnings(project: {
    description?: string;
    requiresPython?: string;
}): string[] {
    const warnings: string[] = [];

    if (!project.description?.trim()) {
        warnings.push("Python project description is missing.");
    }

    if (!project.requiresPython?.trim()) {
        warnings.push("Supported Python versions are not specified.");
    }

    return warnings;
}