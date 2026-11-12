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