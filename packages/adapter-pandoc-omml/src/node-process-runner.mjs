import { spawn } from "node:child_process";
import path from "node:path";

export const PANDOC_PROCESS_RUNNER_VERSION = "0.1.0";

const MAX_ARGUMENTS = 32;
const MAX_ARGUMENT_BYTES = 4 * 1024;
const MAX_ENVIRONMENT_ENTRIES = 16;
const MAX_ENVIRONMENT_VALUE_BYTES = 8 * 1024;
const MAX_EXECUTABLE_BYTES = 4 * 1024;
const MAX_STDIN_BYTES = 64 * 1024;
const MAX_STDOUT_BYTES = 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 10_000;
const encoder = new TextEncoder();

const ALLOWED_ENVIRONMENT_KEYS = new Set([
  "LANG",
  "LC_ALL",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "WINDIR"
]);

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactDataProperties(value, keys) {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set(keys);
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && ownKeys.every((key) => {
    if (typeof key !== "string" || !allowed.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
  });
}

function dataProperty(value, key) {
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

function isBoundedString(value, maximumBytes) {
  return typeof value === "string" && value.length <= maximumBytes &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    encoder.encode(value).byteLength <= maximumBytes;
}

function snapshotEnvironment(value) {
  if (!isPlainRecord(value)) throw new TypeError("pandoc-runner-environment");
  const keys = Reflect.ownKeys(value);
  if (keys.length > MAX_ENVIRONMENT_ENTRIES ||
      keys.some((key) => typeof key !== "string" || !ALLOWED_ENVIRONMENT_KEYS.has(key))) {
    throw new TypeError("pandoc-runner-environment");
  }
  const folded = new Set();
  const snapshot = Object.create(null);
  for (const key of [...keys].sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const normalized = key.toUpperCase();
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value") ||
        folded.has(normalized) ||
        !isBoundedString(descriptor.value, MAX_ENVIRONMENT_VALUE_BYTES)) {
      throw new TypeError("pandoc-runner-environment");
    }
    folded.add(normalized);
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function snapshotArguments(value) {
  if (!Array.isArray(value)) throw new TypeError("pandoc-runner-arguments");
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !Object.hasOwn(length, "value") ||
      !Number.isSafeInteger(length.value) || length.value < 0 || length.value > MAX_ARGUMENTS) {
    throw new TypeError("pandoc-runner-arguments");
  }
  const expected = new Set([
    "length",
    ...Array.from({ length: length.value }, (_, index) => String(index))
  ]);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !expected.has(key)) ||
      Reflect.ownKeys(value).length !== expected.size) {
    throw new TypeError("pandoc-runner-arguments");
  }
  const snapshot = [];
  for (let index = 0; index < length.value; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value") ||
        !isBoundedString(descriptor.value, MAX_ARGUMENT_BYTES)) {
      throw new TypeError("pandoc-runner-arguments");
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

function emptyBytes() {
  return new Uint8Array(0);
}

function outcome(kind, exitCode = null, signal = null, stdout = emptyBytes(), stderr = emptyBytes()) {
  return Object.freeze({
    outcome: kind,
    exitCode,
    signal,
    stdout: new Uint8Array(stdout),
    stderr: new Uint8Array(stderr)
  });
}

function snapshotRequest(value) {
  if (!hasExactDataProperties(value, [
    "arguments",
    "stdin",
    "timeoutMs",
    "maxStdoutBytes",
    "maxStderrBytes"
  ])) {
    throw new TypeError("pandoc-runner-request");
  }
  const argumentsList = dataProperty(value, "arguments");
  const stdin = dataProperty(value, "stdin");
  const timeoutMs = dataProperty(value, "timeoutMs");
  const maxStdoutBytes = dataProperty(value, "maxStdoutBytes");
  const maxStderrBytes = dataProperty(value, "maxStderrBytes");
  if (!(stdin instanceof Uint8Array) || stdin.byteLength > MAX_STDIN_BYTES) {
    throw new TypeError("pandoc-runner-stdin");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS ||
      timeoutMs > MAX_TIMEOUT_MS ||
      !Number.isSafeInteger(maxStdoutBytes) || maxStdoutBytes < 1 ||
      maxStdoutBytes > MAX_STDOUT_BYTES ||
      !Number.isSafeInteger(maxStderrBytes) || maxStderrBytes < 1 ||
      maxStderrBytes > MAX_STDERR_BYTES) {
    throw new TypeError("pandoc-runner-limits");
  }
  return Object.freeze({
    arguments: snapshotArguments(argumentsList),
    stdin: Buffer.from(stdin),
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes
  });
}

/**
 * Create the only Node process-I/O boundary used by the optional Pandoc
 * adapter. The executable and working directory are trusted host
 * configuration; capability data can never supply either value or argv.
 */
export function createPandocProcessRunner(options) {
  if (!hasExactDataProperties(options, ["executable", "workingDirectory", "environment"])) {
    throw new TypeError("pandoc-runner-options");
  }
  const executable = dataProperty(options, "executable");
  const workingDirectory = dataProperty(options, "workingDirectory");
  if (!isBoundedString(executable, MAX_EXECUTABLE_BYTES) ||
      !path.isAbsolute(executable) ||
      !isBoundedString(workingDirectory, MAX_EXECUTABLE_BYTES) ||
      !path.isAbsolute(workingDirectory)) {
    throw new TypeError("pandoc-runner-options");
  }
  const environment = snapshotEnvironment(dataProperty(options, "environment"));

  async function run(candidate) {
    const request = snapshotRequest(candidate);
    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(executable, request.arguments, {
          cwd: workingDirectory,
          env: environment,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true
        });
      } catch {
        resolve(outcome("spawn-failed"));
        return;
      }

      let settled = false;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const stdoutChunks = [];
      const stderrChunks = [];

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdout.destroy();
        child.stderr.destroy();
        child.stdin.destroy();
        resolve(result);
      };

      const terminate = (kind) => {
        if (settled) return;
        try {
          child.kill("SIGKILL");
        } catch {
          // The stable failure result is independent of platform kill details.
        }
        finish(outcome(kind));
      };

      const timer = setTimeout(() => terminate("timed-out"), request.timeoutMs);
      timer.unref?.();

      child.stdout.on("data", (chunk) => {
        if (settled) return;
        stdoutBytes += chunk.length;
        if (stdoutBytes > request.maxStdoutBytes) {
          terminate("output-limit");
          return;
        }
        stdoutChunks.push(Buffer.from(chunk));
      });
      child.stderr.on("data", (chunk) => {
        if (settled) return;
        stderrBytes += chunk.length;
        if (stderrBytes > request.maxStderrBytes) {
          terminate("output-limit");
          return;
        }
        stderrChunks.push(Buffer.from(chunk));
      });
      child.stdin.on("error", () => {
        // Early process exit can close stdin; close/error determines outcome.
      });
      child.once("error", (error) => {
        finish(outcome(error?.code === "ENOENT" ? "not-found" : "spawn-failed"));
      });
      child.once("close", (exitCode, signal) => {
        if (settled) return;
        if (signal !== null) {
          finish(outcome("signaled", null, String(signal)));
          return;
        }
        finish(outcome(
          "completed",
          Number.isSafeInteger(exitCode) ? exitCode : null,
          null,
          Buffer.concat(stdoutChunks, stdoutBytes),
          Buffer.concat(stderrChunks, stderrBytes)
        ));
      });
      child.stdin.end(request.stdin);
    });
  }

  return Object.freeze({
    runnerVersion: PANDOC_PROCESS_RUNNER_VERSION,
    runnerType: "pandoc-process-runner",
    run
  });
}
