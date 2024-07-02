# CronStack

_cronstack_ is a versatile library for managing tasks, scheduling functions. It allows you to automate the execution of functions through triggers or scheduled intervals. The package includes powerful CLI tools for managing your tasks, transpiling code, and bundling resources.

## Installation

```bash
npm install cronstack
```

### Directory Structure

For the service to be recognized, ensure your service file follows the pattern:

1. Directly under the `services` directory.

```text
+<name>.service.ts
```

2. Directory with name of the service under `services` directory.

```text
<name>/+service.ts
```

Notice that you can put the `services` directory in `src` as well.

###### Example

```text
project-root
|-- services
|   |-- +<name>.service.ts
|   |-- <name>
|       |-- +service.ts
```

## Initialize Project

###### Command

```bash
npx cronstack init
```

## Creating a new Service

###### Command

```bash
cronstack add <name> --interval <interval>
```

## License

[MIT](../../LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi)
