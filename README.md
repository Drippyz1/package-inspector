# Package Inspector

A TypeScript command-line tool for inspecting JavaScript and TypeScript projects.

Package Inspector aims to help developers understand their projects, identify configuration problems, and improve project health.

> Status: Early development (pre-release)

## Current Features

- Inspect a project using its folder path
- Read project information from package.json
- Display project name and version
- Display available development script
- Count dependencies and dev dependencies
- Validate project name and version types
- Handle missing files and invalid project information

## Getting Started

### Requirements

- Node.js
- npm

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Drippyz1/package-inspector.git
cd package-inspector
npm install
```

### Usage

Inspect the current project:

```bash
npm run dev
```

Inspect another project:

```bash
npm run dev -- /path/to/project
```

## Planned Features

- Framework and package manager detection
- Project configuration checks
- Dependency and project health analysis
- Actionable improvement recommendations
- JSON and HTML reports
- CI/CD integration and automation
- Automated testing

## License

Source available under the PolyForm Perimeter License 1.0.1.

See [LICENSE](LICENSE) for the complete terms.

This project is source-available, not OSI-approved open source.
