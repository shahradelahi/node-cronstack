# TaskFlow

TaskFlow is a versatile library for managing tasks, scheduling functions, and streamlining your development workflow. It allows you to automate the execution of functions through triggers or scheduled intervals. The package includes powerful CLI tools for managing your tasks, transpiling code, and bundling resources.

## Key Features

- **Function Scheduling:** Schedule tasks to run at specified intervals or in response to triggers.
- **Automation:** Automate the execution of functions, reducing manual intervention.
- **CLI Tools:** Command-line interface tools for seamless development workflow, including transpiling and bundling code.
- **Versatility:** Suitable for various use cases, from general-purpose automation to microservices development.

## Installation

```bash
npm install @litehex/taskflow
```

## Initialize Project

```bash
npx @litehex/taskflow init
```

### Directory Structure

For the service to be recognized, ensure your service file follows the pattern:

    +<name>.service.ts directly under the services directory.
    <name>/+service.ts under the services directory.

###### Example

```text
project-root
|-- services
|   |-- +<name>.service.ts
|   |-- <service-name>
|       |-- +service.ts
```

## Creating a new Service

TaskFlow makes it easy to create and manage services within your project. Follow these steps to add a new service:

### Command

```bash
taskflow add <name> --interval <interval>
```

## License

This project is licensed under the GNU GPLv3 License - see the [LICENSE](LICENSE) file for details.
