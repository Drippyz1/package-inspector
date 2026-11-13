/**
 * An actionable, non-fatal finding produced by an inspection rule.
 *
 * Malformed project files are rejected by the inspectors and must not be
 * converted into health findings. This type is independent of terminal output.
 */
export type DiagnosticSeverity = "info" | "warning";

export type Diagnostic = {
    /** Stable identifier for a specific rule, such as PI-NODE-001. */
    code: string;
    severity: DiagnosticSeverity;
    title: string;
    message: string;
    recommendation: string;
};
