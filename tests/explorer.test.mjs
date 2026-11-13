import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectEcosystemsFromFiles } from "../src/detect.ts";
import { inspectProject } from "../src/inspection.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const nodeProject = (overrides = {}) => JSON.stringify({
    name: "sample-app",
    version: "1.2.3",
    description: "An example app",
    scripts: { test: "node --test" },
    ...overrides
});

async function withProject(entries, callback) {
    const directory = await mkdtemp(join(tmpdir(), "package-inspector-explorer-"));
    try {
        for (const [relativePath, data] of Object.entries(entries)) {
            const file = join(directory, relativePath);
            await mkdir(join(file, ".."), { recursive: true });
            await writeFile(file, data);
        }
        return await callback(directory);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

function runCli(directory) {
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/index.ts", directory], {
        cwd: projectRoot,
        encoding: "utf8"
    });
    if (result.error) throw result.error;
    return result;
}

test("project overview exposes validated Node identity with source provenance", async () => {
    await withProject({ "package.json": nodeProject() }, async (directory) => {
        const result = await inspectProject(directory);
        assert.equal(result.overview.scope, "project-root");
        assert.deepEqual(result.overview.identities, [{
            ecosystem: "JavaScript / TypeScript",
            manifest: "package.json",
            name: "sample-app",
            version: "1.2.3",
            versionStatus: "declared",
            description: "An example app"
        }]);
        assert.deepEqual(result.overview.recognizedFiles, [{
            path: "package.json", category: "manifest", status: "inspected"
        }]);
        assert.deepEqual(result.diagnostics, []);
    });
});

test("Python identity preserves dynamic version semantics", async () => {
    await withProject({
        "pyproject.toml": '[project]\nname = "dynamic-app"\ndynamic = ["version"]\n'
    }, async (directory) => {
        const result = await inspectProject(directory);
        const identity = result.overview.identities[0];
        assert.equal(identity.name, "dynamic-app");
        assert.equal(identity.manifest, "pyproject.toml");
        assert.equal(identity.versionStatus, "dynamic");
        assert.equal(identity.version, undefined);
    });
});

test("requirements-only projects do not invent names or versions", async () => {
    await withProject({ "requirements.txt": "requests>=2.32\n" }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.identities, [{
            ecosystem: "Python", manifest: "requirements.txt", versionStatus: "unavailable"
        }]);
        assert.equal(result.overview.recognizedFiles[0].status, "inspected");
    });
});

test("mixed projects keep distinct identities rather than merging unrelated metadata", async () => {
    await withProject({
        "package.json": nodeProject(),
        "pyproject.toml": '[project]\nname = "python-side"\nversion = "4.5.6"\n'
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.identities.map((p) => p.name), ["sample-app", "python-side"]);
        assert.deepEqual(result.overview.identities.map((p) => p.manifest), ["package.json", "pyproject.toml"]);
        assert.equal(result.sections.length, 2);
    });
});

test("pyproject takes precedence but the additional requirements file is still discovered", async () => {
    await withProject({
        "pyproject.toml": '[project]\nname = "python-main"\nversion = "0.1.0"\n',
        "requirements.txt": "-r extras.txt\n"
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.recognizedFiles.map((f) => [f.path, f.status]), [
            ["pyproject.toml", "inspected"],
            ["requirements.txt", "detected-only"]
        ]);
        assert.equal(result.diagnostics.some((d) => d.code === "PI-REQ-001"), false);
        assert.match(result.coverage[0].details, /requirements.txt was not inspected/);
    });
});

test("discover configuration, documentation, and lockfiles without claiming to parse them", async () => {
    await withProject({
        "package.json": nodeProject(),
        "tsconfig.json": '{ invalid JSON to ensure it is not parsed }',
        "README.md": "# Readme\n",
        "package-lock.json": "not-actually-json",
        "vite.config.ts": 'throw new Error("must not execute");'
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.recognizedFiles.map((f) => [f.path, f.status]), [
            ["package-lock.json", "detected-only"],
            ["package.json", "inspected"],
            ["README.md", "detected-only"],
            ["tsconfig.json", "detected-only"],
            ["vite.config.ts", "detected-only"]
        ]);
        assert.deepEqual(result.overview.packageManagerEvidence, [
            { manager: "npm", file: "package-lock.json" }
        ]);
    });
});

test("multiple package-manager lockfiles are reported as evidence without a false diagnosis", async () => {
    await withProject({
        "package.json": nodeProject(),
        "yarn.lock": "",
        "pnpm-lock.yaml": "",
        "bun.lock": ""
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.packageManagerEvidence, [
            { manager: "Bun", file: "bun.lock" },
            { manager: "pnpm", file: "pnpm-lock.yaml" },
            { manager: "Yarn", file: "yarn.lock" }
        ]);
        assert.deepEqual(result.diagnostics, []);
    });
});

test("no package-manager lockfile is not misreported as a specific manager", async () => {
    await withProject({ "package.json": nodeProject() }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.packageManagerEvidence, []);
    });
});

test("workspace markers are recognized without pretending workspaces were traversed", async () => {
    await withProject({
        "package.json": nodeProject(),
        "pnpm-workspace.yaml": "packages: []\n",
        "nx.json": "{}",
        "go.work": "go 1.23\n"
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.workspaceMarkers, ["go.work", "nx.json", "pnpm-workspace.yaml"]);
        assert.equal(result.overview.scope, "project-root");
    });
});

test("common directories are intentionally allowlisted and not recursively scanned", async () => {
    await withProject({ "package.json": nodeProject() }, async (directory) => {
        for (const name of ["src", "tests", "docs", "node_modules", ".git", "random-subtree"]) {
            await mkdir(join(directory, name), { recursive: true });
        }
        await writeFile(join(directory, "src", "Cargo.toml"), "not a root manifest");
        await writeFile(join(directory, "random-subtree", "package.json"), nodeProject());
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.commonDirectories, ["docs", "src", "tests"]);
        assert.deepEqual(result.detectedEcosystems, ["JavaScript / TypeScript"]);
        assert.deepEqual(result.overview.recognizedFiles.map((f) => f.path), ["package.json"]);
    });
});

test("detected-only Rust and Java files remain uninspected in Explorer data", async () => {
    await withProject({
        "Cargo.toml": '[package]\nname = "anything"\n',
        "pom.xml": "<project/>",
        "go.mod": "module example.org/test\n"
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.detectedEcosystems, ["Java / JVM", "Rust", "Go"]);
        assert.equal(result.overview.identities.length, 0);
        assert.equal(result.overview.recognizedFiles.length, 3);
        assert.equal(result.overview.recognizedFiles.every((f) => f.status === "detected-only"), true);
        assert.deepEqual(result.coverage.map((c) => c.level), ["detected-only", "detected-only", "detected-only"]);
    });
});

test("pure ecosystem detection preserves the established ecosystem ordering", () => {
    assert.deepEqual(detectEcosystemsFromFiles(new Set([
        "go.mod", "Cargo.toml", "requirements.txt", "package.json", "pom.xml"
    ])), ["JavaScript / TypeScript", "Python", "Java / JVM", "Rust", "Go"]);
});

test("unrecognized filenames and secret-like files are not exposed as Explorer inventory", async () => {
    await withProject({
        "package.json": nodeProject(),
        ".env": "PASSWORD=not-for-display",
        "credentials.json": "secret",
        "deploy.sh": "#!/bin/sh\n"
    }, async (directory) => {
        const result = await inspectProject(directory);
        assert.deepEqual(result.overview.recognizedFiles.map((f) => f.path), ["package.json"]);
        const cli = runCli(directory);
        assert.equal(cli.status, 0);
        assert.doesNotMatch(cli.stdout, /PASSWORD=|credentials\.json|deploy\.sh/);
    });
});

test("symbolic links are not treated as project-root manifests", async () => {
    await withProject({ "real-package.json": nodeProject() }, async (directory) => {
        await symlink("real-package.json", join(directory, "package.json"));
        const result = await inspectProject(directory);
        assert.deepEqual(result.detectedEcosystems, []);
        assert.deepEqual(result.overview.recognizedFiles, []);
    });
});

test("CLI shows the Project Explorer before existing health diagnostics", async () => {
    await withProject({
        "package.json": nodeProject({ description: undefined }),
        "README.md": "# Sample\n",
        "tsconfig.json": "{}",
        "pnpm-lock.yaml": ""
    }, async (directory) => {
        const result = runCli(directory);
        assert.equal(result.status, 0);
        assert.match(result.stdout, /Project Explorer:/);
        assert.match(result.stdout, /Discovery Scope: Project root only/);
        assert.match(result.stdout, /JavaScript \/ TypeScript: sample-app \(v1\.2\.3; package\.json\)/);
        assert.match(result.stdout, /README\.md \[documentation, detected-only\]/);
        assert.match(result.stdout, /pnpm \(pnpm-lock\.yaml\)/);
        assert.ok(result.stdout.indexOf("Project Explorer:") < result.stdout.indexOf("Health Checks:"));
        assert.match(result.stdout, /\[PI-NODE-001\]/);
    });
});

test("detected-only projects still show an Explorer report but exit non-zero", async () => {
    await withProject({ "Cargo.toml": '[package]\nname="not-parsed"\n' }, async (directory) => {
        const result = runCli(directory);
        assert.equal(result.status, 1);
        assert.match(result.stdout, /Project Explorer:/);
        assert.match(result.stdout, /Cargo\.toml \[manifest, detected-only\]/);
        assert.match(result.stderr, /Full inspection currently supports/);
        assert.doesNotMatch(result.stdout, /Health Checks:/);
    });
});

test("CLI escapes terminal-control characters in untrusted package fields", async () => {
    await withProject({
        "package.json": nodeProject({
            name: "unsafe\u001b[31m\nname\u202e",
            description: "hello\u001b[2Jworld",
            scripts: { test: "ok\u001b[31m" }
        })
    }, async (directory) => {
        const result = runCli(directory);
        assert.equal(result.status, 0);
        assert.doesNotMatch(result.stdout, /\u001b|\u0000|\u202e/);
        assert.match(result.stdout, /unsafe \[31m name/);
        assert.match(result.stdout, /Description: hello \[2Jworld/);
    });
});

test("invalid metadata still fails before the Explorer is printed", async () => {
    await withProject({ "package.json": '{"name":"x","version":12}' }, async (directory) => {
        const result = runCli(directory);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Project version must be text/);
        assert.doesNotMatch(result.stdout, /Project Explorer:/);
    });
});

test("project script declarations are only read as strings, never executed", async () => {
    await withProject({
        "package.json": nodeProject({
            scripts: { test: "node -e \"require('fs').writeFileSync('executed', 'BAD')\"" }
        }),
        "vite.config.ts": "process.exit(42);"
    }, async (directory) => {
        const result = runCli(directory);
        assert.equal(result.status, 0);
        assert.equal(existsSync(join(directory, "executed")), false);
    });
});
