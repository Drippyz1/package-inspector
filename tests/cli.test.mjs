import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function runInspector(...args) {
    const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "src/index.ts", ...args],
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
    assert.match(result.stdout, /^Selected folder: \.$/m);
    assert.match(result.stdout, /Detected Project: package-inspector/);
    assert.match(result.stdout, /Available Scripts:/);
});

test("defaults to the current directory when no path is provided", () => {
    const result = runInspector();

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^Selected folder: \.$/m);
    assert.match(result.stdout, /Detected Project: package-inspector/);
    assert.match(result.stdout, /Inspection Summary:\n  Ecosystems Detected: 1\n  Ecosystems Inspected: 1/);
});

test("shows help without inspecting an invalid project", () => {
    const result = runInspector("--help", "./test-projects/invalid-object");

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^Usage: .*\[project-path\]/m);
    for (const option of ["--help", "--version", "--brief"]) {
        assert.ok(result.stdout.includes(option));
    }
    assert.doesNotMatch(result.stdout, /Selected folder:|Inspection Summary:/);
});

test("shows the current version without inspecting an invalid project", () => {
    const result = runInspector("./test-projects/invalid-object", "--version");

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim(), "0.1.0");
});

test("rejects unknown options and multiple project paths before inspection", () => {
    for (const [args, message] of [
        [["--help", "--unknown\u001b[2J\n"], /Unknown option.*--unknown/],
        [[".", "--brief", "./test-projects/health-warnings"], /at most one project path/]
    ]) {
        const result = runInspector(...args);
        assert.equal(result.status, 1);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, message);
        assert.match(result.stderr, /--help for usage/);
        assert.doesNotMatch(result.stderr, /\u001b|\n.+/);
    }
});

test("treats a dash-prefixed project path as positional after the option terminator", () => {
    const result = runInspector("--brief", "--", "--version");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Inspection Failed:.*ENOENT/);
    assert.match(result.stdout, /^Selected folder: --version$/m);
});

test("rejects invalid scripts", () => {
    const result = runInspector("./test-projects/invalid-script");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Script "build" must be text/);
    assert.doesNotMatch(result.stdout, /Health Checks:|Inspection Summary:/);
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
    assert.doesNotMatch(result.stdout, /\[PASS\]/);
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
    assert.match(result.stdout, /Ecosystems Inspected: 0/);
    assert.match(result.stdout, /Java \/ JVM \[detected-only\]: Project files detected/);
    assert.match(
        result.stderr,
        /Full inspection currently supports JavaScript\/TypeScript and Python projects only/
    );
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
    const result = runInspector("./test-projects/python-requirements-only");

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
    const result = runInspector("./test-projects/python-requirements-only");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[WARN\] \[PI-REQ-001\] Requirements directives were not expanded/);
    assert.match(result.stdout, /Requirements directives were not expanded/);
    assert.match(result.stdout, /Recommendation: Review the directives in requirements\.txt manually/);
    assert.match(result.stdout, /Total Warnings: 1/);
});

test("renders structured Node diagnostics with actionable recommendations", () => {
    const result = runInspector("./test-projects/health-warnings");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[WARN\] \[PI-NODE-001\] Project description is missing/);
    assert.match(result.stdout, /Recommendation: Consider adding a description to package\.json/);
    assert.match(result.stdout, /\[WARN\] \[PI-NODE-002\] No test script is configured/);
    assert.match(result.stdout, /Recommendation: Add an npm test script or document the existing test workflow/);
});

test("renders structured Python diagnostics without failing", () => {
    const result = runInspector("./test-projects/python-dynamic-version");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[WARN\] \[PI-PY-001\] Python project description is missing/);
    assert.match(result.stdout, /Python project description is missing/);
    assert.match(result.stdout, /\[WARN\] \[PI-PY-002\] Supported Python versions are not specified/);
    assert.match(result.stdout, /Supported Python versions are not specified/);
    assert.match(result.stdout, /Recommendation: Consider adding requires-python under \[project\]/);
    assert.match(result.stdout, /Total Warnings: 2/);
});

async function withTempProject(files, callback) {
    const projectPath = await mkdtemp(join(tmpdir(), "package-inspector-test-"));

    try {
        for (const [name, content] of Object.entries(files)) {
            await writeFile(join(projectPath, name), content);
        }

        return await callback(projectPath);
    } finally {
        await rm(projectPath, { recursive: true, force: true });
    }
}

test("brief mode includes a mixed project's identities, diagnostics, and coverage in either flag position", async () => {
    await withTempProject({
        "package.json": JSON.stringify({ name: "brief-node", version: "1.0.0" }),
        "pyproject.toml": '[project]\nname = "brief-python"\ndynamic = ["version"]\n',
        "Cargo.toml": "",
        "README.md": "# Mixed project\n"
    }, (path) => {
        const before = runInspector("--brief", path);
        const after = runInspector(path, "--brief");

        for (const result of [before, after]) {
            assert.equal(result.status, 0);
            assert.equal(result.stderr, "");
        }
        assert.equal(before.stdout, after.stdout);
        assert.match(before.stdout, /JavaScript \/ TypeScript: brief-node \(v1\.0\.0; package\.json\)/);
        assert.match(before.stdout, /Python: brief-python \(Dynamic version; pyproject\.toml\)/);
        assert.match(before.stdout, /Inspection Summary:\n  Ecosystems Detected: 3\n  Ecosystems Inspected: 2/);
        assert.match(before.stdout, /Coverage: 2 basic, 0 limited, 1 detected-only/);
        assert.match(before.stdout, /Total Warnings: 4\n  Informational Diagnostics: 0/);
        assert.match(before.stdout, /\[PI-NODE-001\]/);
        assert.match(before.stdout, /\[PI-NODE-002\]/);
        assert.match(before.stdout, /\[PI-PY-001\]/);
        assert.match(before.stdout, /\[PI-PY-002\]/);
        assert.match(before.stdout, /Recommendation: .*requires-python/);
        assert.match(before.stdout, /Inspection Coverage:/);
        assert.match(before.stdout, /Discovery Scope: Project root only/);
        assert.match(before.stdout, /Rust \[detected-only\]: .*no inspection rules/);
        assert.doesNotMatch(before.stdout, /Project Explorer:|Recognized Files:|README\.md|Available Scripts:/);
    });
});

test("sanitizes paths and validation errors in brief mode", async () => {
    await withTempProject({
        "package.json": JSON.stringify({
            name: "invalid-example",
            version: "1.0.0",
            scripts: { ["bad\u001b[2J\u009b\n\r\u200f\u2028\u2066script"]: 123 }
        })
    }, (path) => {
        const invalid = runInspector("--brief", path);
        assert.equal(invalid.status, 1);
        assert.match(invalid.stderr, /^Inspection Failed: Error: Script "bad \[2J +script" must be text\.\n$/);
        assert.doesNotMatch(invalid.stdout, /Inspection Summary:|Health Checks:/);

        const missing = runInspector(join(path, "untrusted\n\u202e-path"));
        assert.equal(missing.status, 1);
        assert.match(missing.stdout, /Selected folder: .*untrusted  -path\n$/);
        assert.match(missing.stderr, /Inspection Failed:.*ENOENT.*untrusted  -path/);
        assert.doesNotMatch(missing.stderr, /\u202e|\n.+/);
    });
});

test("discloses basic Node inspection coverage", () => {
    const result = runInspector(".");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Inspection Coverage:/);
    assert.match(result.stdout, /JavaScript \/ TypeScript \[basic\]: package\.json metadata/);
    assert.match(result.stdout, /no script execution, dependency resolution, or vulnerability audit/);
});

test("discloses limited requirements-file coverage", () => {
    const result = runInspector("./test-projects/python-requirements-only");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Python \[limited\]: requirements\.txt entries counted/);
    assert.match(result.stdout, /directives, includes, and package versions were not resolved/);
});

test("brief mode counts limited inspection and retains requirements directives guidance", () => {
    const result = runInspector("--brief", "./test-projects/python-requirements-only");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Python: Metadata unavailable \(Version unavailable; requirements\.txt\)/);
    assert.match(result.stdout, /Ecosystems Inspected: 1/);
    assert.match(result.stdout, /Coverage: 0 basic, 1 limited, 0 detected-only/);
    assert.match(result.stdout, /\[WARN\] \[PI-REQ-001\]/);
    assert.match(result.stdout, /Recommendation: Review the directives in requirements\.txt manually/);
    assert.match(result.stdout, /directives, includes, and package versions were not resolved/);
});

test("does not warn about directives in a simple requirements file", async () => {
    await withTempProject({ "requirements.txt": "requests>=2.32\n" }, async (path) => {
        const result = runInspector(path);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /Requirement Entries: 1/);
        assert.match(result.stdout, /Unprocessed Directives: 0/);
        assert.match(result.stdout, /No basic warnings found/);
        assert.doesNotMatch(result.stdout, /PI-REQ-001/);
    });
});

test("aggregates diagnostics for Node and Python in one report", async () => {
    await withTempProject({
        "package.json": JSON.stringify({ name: "mixed-project", version: "1.0.0" }),
        "pyproject.toml": '[project]\nname = "mixed-python"\nversion = "1.0.0"\n'
    }, async (path) => {
        const result = runInspector(path);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /Detected Ecosystems: JavaScript \/ TypeScript, Python/);
        assert.match(result.stdout, /Detected Project: mixed-project/);
        assert.match(result.stdout, /Detected Python Project: mixed-python/);
        assert.match(result.stdout, /\[PI-NODE-001\]/);
        assert.match(result.stdout, /\[PI-NODE-002\]/);
        assert.match(result.stdout, /\[PI-PY-001\]/);
        assert.match(result.stdout, /\[PI-PY-002\]/);
        assert.match(result.stdout, /Total Warnings: 4/);
        assert.equal((result.stdout.match(/Health Checks:/g) ?? []).length, 1);
    });
});

test("reports detected-only ecosystems alongside inspected ones", async () => {
    await withTempProject({
        "package.json": JSON.stringify({
            name: "node-and-rust",
            version: "1.0.0",
            description: "Example",
            scripts: { test: "node --test" }
        }),
        "Cargo.toml": '[package]\nname = "secondary"\nversion = "0.1.0"\n'
    }, async (path) => {
        const result = runInspector(path);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /Detected Ecosystems: JavaScript \/ TypeScript, Rust/);
        assert.match(result.stdout, /Ecosystems Detected: 2\n  Ecosystems Inspected: 1/);
        assert.match(result.stdout, /Coverage: 1 basic, 0 limited, 1 detected-only/);
        assert.match(result.stdout, /Rust \[detected-only\]: Project files detected/);
        assert.match(result.stdout, /Detected Project: node-and-rust/);
    });
});

test("explains which Python configuration was actually inspected", async () => {
    await withTempProject({
        "pyproject.toml": '[project]\nname = "prefer-toml"\nversion = "0.1.0"\n',
        "requirements.txt": "-r another-file.txt\n"
    }, async (path) => {
        const result = runInspector(path);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /Detected Python Project: prefer-toml/);
        assert.match(result.stdout, /requirements\.txt was not inspected/);
        assert.doesNotMatch(result.stdout, /PI-REQ-001/);
        assert.doesNotMatch(result.stdout, /Requirement Entries:/);
    });
});


test("unknown project returns an unsupported inspection error", async () => {
    await withTempProject({ "README.md": "Only documentation here.\n" }, async (path) => {
        const result = runInspector(path);

        assert.equal(result.status, 1);
        assert.match(result.stdout, /Detected Ecosystems: Unknown/);
        assert.match(result.stdout, /Ecosystems Detected: 0\n  Ecosystems Inspected: 0/);
        assert.match(result.stdout, /No ecosystems detected\./);
        assert.match(result.stderr, /Full inspection currently supports/);
    });
});

test("never runs scripts declared by an inspected project", async () => {
    await withTempProject({
        "package.json": JSON.stringify({
            name: "untrusted-project",
            version: "1.0.0",
            scripts: {
                test: "node -e \"require('node:fs').writeFileSync('marker-created', 'unsafe')\""
            }
        })
    }, async (path) => {
        const result = runInspector(path);

        assert.equal(result.status, 0);
        assert.equal(existsSync(join(path, "marker-created")), false);
    });
});
