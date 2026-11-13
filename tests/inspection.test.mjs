import test from "node:test";
import assert from "node:assert/strict";
import { inspectProject } from "../src/inspection.ts";
import {
    getNodeHealthDiagnostics,
    getPythonHealthDiagnostics,
    getRequirementsHealthDiagnostics
} from "../src/health.ts";

test("Node diagnostics have stable codes and complete recommended actions", () => {
    const diagnostics = getNodeHealthDiagnostics({});

    assert.deepEqual(diagnostics.map((item) => item.code), [
        "PI-NODE-001",
        "PI-NODE-002"
    ]);

    for (const finding of diagnostics) {
        assert.equal(finding.severity, "warning");
        for (const field of ["code", "title", "message", "recommendation"]) {
            assert.equal(typeof finding[field], "string");
            assert.ok(finding[field].trim().length > 0);
        }
    }
});

test("healthy Node metadata produces no basic findings", () => {
    assert.deepEqual(getNodeHealthDiagnostics({
        description: "An example project",
        scripts: { test: "node --test" }
    }), []);
});

test("Python diagnostic rules target their respective missing fields", () => {
    assert.deepEqual(
        getPythonHealthDiagnostics({ description: "Documented" }).map((item) => item.code),
        ["PI-PY-002"]
    );
    assert.deepEqual(
        getPythonHealthDiagnostics({ requiresPython: ">=3.11" }).map((item) => item.code),
        ["PI-PY-001"]
    );
    assert.deepEqual(
        getPythonHealthDiagnostics({ description: "Documented", requiresPython: ">=3.11" }),
        []
    );
});

test("requirements directive warning is conditional", () => {
    assert.deepEqual(getRequirementsHealthDiagnostics({ directives: [] }), []);
    assert.deepEqual(
        getRequirementsHealthDiagnostics({ directives: ["-r extras.txt"] }).map((item) => item.code),
        ["PI-REQ-001"]
    );
});

test("programmatic inspection returns typed metadata, diagnostics and coverage", async () => {
    const result = await inspectProject("./test-projects/health-warnings");

    assert.equal(result.projectPath, "./test-projects/health-warnings");
    assert.deepEqual(result.detectedEcosystems, ["JavaScript / TypeScript"]);
    assert.equal(result.sections.length, 1);
    assert.equal(result.sections[0].kind, "node");
    assert.equal(result.sections[0].data.name, "health-warning-test");
    assert.deepEqual(result.diagnostics.map((item) => item.code), [
        "PI-NODE-001", "PI-NODE-002"
    ]);
    assert.deepEqual(result.coverage.map((item) => item.level), ["basic"]);
});

test("unsupported ecosystem is represented honestly without a fake inspection", async () => {
    const result = await inspectProject("./test-projects/java-project");

    assert.deepEqual(result.detectedEcosystems, ["Java / JVM"]);
    assert.deepEqual(result.sections, []);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.coverage.map((item) => item.level), ["detected-only"]);
});

test("invalid metadata rejects instead of returning a nonfatal diagnostic", async () => {
    await assert.rejects(
        inspectProject("./test-projects/invalid-script"),
        /Script "build" must be text/
    );
});
