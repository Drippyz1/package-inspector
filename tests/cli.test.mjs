import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function runInspector(projectPath) {
    const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "src/index.ts", projectPath],
        {
            cwd: projectRoot,
            encoding: "utf8"
        }
    );

    if (result.error) {
        throw result.error;
    }

    return result;
}

test("inspects a valid project", () => {
    const result = runInspector(".");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Detected Project: package-inspector/);
    assert.match(result.stdout, /Available Scripts:/);
});

test("rejects invalid scripts", () => {
    const result = runInspector("./test-projects/invalid-script");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Script "build" must be text/);
});

test("rejects invalid dependency versions", () => {
    const result = runInspector("./test-projects/invalid-dependency-version");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /express must have a text version/);
});

test("rejects invalid package data", () => {
    const result = runInspector("./test-projects/invalid-object");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Package data must be an object/);
});

test("rejects invalid dependencies", () => {
    const result = runInspector("./test-projects/invalid-dependencies");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Dependencies must be an object/);
});

test("rejects invalid development dependencies", () => {
    const result = runInspector("./test-projects/invalid-dev-dependencies");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Development Dependencies must be an object/);
});

test("reports health warnings without failing", () => {
    const result = runInspector("./test-projects/health-warnings");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Project description is missing/);
    assert.match(result.stdout, /No test script is configured/);
    assert.match(result.stdout, /Total Warnings: 2/);
});

test("reports no basic warnings for a configured project", () => {
    const result = runInspector(".");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /No basic warnings found/);
});

test("detects JavaScript and TypeScript projects", () => {
    const result = runInspector(".");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Detected Ecosystems: JavaScript \/ TypeScript/);
});

test("inspects Python projects", () => {
    const result = runInspector("./test-projects/python-project");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Detected Ecosystems: Python/);
    assert.match(result.stdout, /Detected Python Project: python-example/);
    assert.match(result.stdout, /Python Dependencies: 2/);
    assert.match(result.stdout, /No basic warnings found/);
    assert.equal(
    (result.stdout.match(/Detected Python Project:/g) ?? []).length,
    1
);
});

test("detects Java projects", () => {
    const result = runInspector("./test-projects/java-project");

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Detected Ecosystems: Java \/ JVM/);
    assert.match(result.stderr, /Full inspection currently supports JavaScript\/TypeScript and Python projects only/);
});

test("rejects invalid project descriptions", () => {
    const result = runInspector("./test-projects/invalid-description");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Project description must be text/);
});

test("rejects invalid Python dependencies", () => {
    const result = runInspector("./test-projects/python-invalid-dependencies");

    assert.equal(result.status, 1);
    assert.match(
        result.stderr,
        /Python dependencies must be an array of strings/
    );
});

test("supports dynamic Python project versions", () => {
    const result = runInspector("./test-projects/python-dynamic-version");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Detected Python Project: dynamic-python-example/);
    assert.match(result.stdout, /Version: Dynamic/);
});

test("inspects requirements-only Python projects", () => {
    const result = runInspector(
        "./test-projects/python-requirements-only"
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Python Configuration: requirements.txt/);
    assert.match(result.stdout, /Requirement Entries: 2/);
    assert.match(result.stdout, /Unprocessed Directives: 1/);
    assert.equal(
    (result.stdout.match(/Python Configuration: requirements.txt/g) ?? []).length,
    1
);
});

test("warns when requirements directives are not expanded", () => {
    const result = runInspector(
        "./test-projects/python-requirements-only"
    );

    assert.equal(result.status, 0);
    assert.match(
        result.stdout,
        /Requirements directives were not expanded/
    );
});