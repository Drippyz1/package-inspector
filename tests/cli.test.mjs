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