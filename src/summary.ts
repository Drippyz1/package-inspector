import type { DiagnosticSeverity } from "./diagnostics.js";
import type { InspectionCoverage, InspectionResult } from "./inspection.js";

export type InspectionSummary = {
    ecosystemsDetected: number;
    ecosystemsInspected: number;
    coverageCounts: Record<InspectionCoverage["level"], number>;
    diagnosticCounts: Record<DiagnosticSeverity, number>;
};

/** Derive counts from a completed inspection without changing its result. */
export function summarizeInspection(result: InspectionResult): InspectionSummary {
    const coverageCounts: InspectionSummary["coverageCounts"] = {
        basic: 0,
        limited: 0,
        "detected-only": 0
    };
    for (const item of result.coverage) {
        coverageCounts[item.level]++;
    }

    const diagnosticCounts: InspectionSummary["diagnosticCounts"] = { warning: 0, info: 0 };
    for (const diagnostic of result.diagnostics) {
        diagnosticCounts[diagnostic.severity]++;
    }

    return {
        ecosystemsDetected: result.detectedEcosystems.length,
        ecosystemsInspected: coverageCounts.basic + coverageCounts.limited,
        coverageCounts,
        diagnosticCounts
    };
}
