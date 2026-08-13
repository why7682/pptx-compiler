import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createAlphaSigstoreBundleVerifier,
  createAlphaNpmPublishEnvironment,
  executeAlphaRegistryPublication as executeAlphaRegistryPublicationImpl,
  parseAlphaPublicationArguments,
  runAlphaPublication,
  validateAlphaNpmProvenanceEnvironment,
  verifyAlphaGitHubSource,
  verifyAlphaPredecessorCore,
  verifyMutableAlphaGitHubSource,
  withMaterializedAlphaTarball
} from "../scripts/publish-alpha-release.mjs";
import {
  ALPHA_PREDECESSOR_RELEASE_LOCK,
  parseAlphaReleaseLockBytes,
  predecessorCoreTarballFromLock
} from "../scripts/lib/alpha-release.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const predecessorLockBytes = await readFile(path.join(
  repositoryRoot,
  ALPHA_PREDECESSOR_RELEASE_LOCK.path
));
const TAG = "v0.1.0-alpha.3";
const VERSION = "0.1.0-alpha.3";
const HEAD = "b".repeat(40);
const MAIN_TIP = "c".repeat(40);
const TAG_OBJECT = "a".repeat(40);
const OWNER_ID = "2468";
const REGISTRY = "https://registry.npmjs.org/";
const PREDECESSOR_TAG = "v0.1.0-alpha.2";
const PREDECESSOR_VERSION = "0.1.0-alpha.2";
const PREDECESSOR_HEAD = "b884b39bdded17d7bc2ccedad159605523329bae";
const ARGV = Object.freeze({
  verify: Object.freeze([
    "--mode", "verify-source", "--tag", TAG,
    "--stage-root", ".package-stage/reviewed"
  ]),
  publish: Object.freeze([
    "--mode", "publish", "--tag", TAG,
    "--stage-root", ".package-stage/reviewed"
  ])
});
const ENTRIES = Object.freeze([
  Object.freeze({
    packageId: "core",
    name: "pptx-compiler-core",
    version: VERSION,
    tarball: `pptx-compiler-core-${VERSION}.tgz`
  }),
  Object.freeze({
    packageId: "native-card-arrow",
    name: "pptx-compiler-native-card-arrow",
    version: VERSION,
    tarball: `pptx-compiler-native-card-arrow-${VERSION}.tgz`
  }),
  Object.freeze({
    packageId: "public-synthetic",
    name: "pptx-compiler-public-synthetic",
    version: VERSION,
    tarball: `pptx-compiler-public-synthetic-${VERSION}.tgz`
  }),
  Object.freeze({
    packageId: "cli",
    name: "pptx-compiler",
    version: VERSION,
    tarball: `pptx-compiler-${VERSION}.tgz`
  })
]);

function executeAlphaRegistryPublication(options = {}) {
  return executeAlphaRegistryPublicationImpl({
    verifyProvenanceBundle: async () => true,
    verifyPredecessorBundle: async () => true,
    verifyPredecessor: async () => true,
    wait: async () => {},
    ...options
  });
}

function digest(algorithm, bytes, encoding = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function tarballs() {
  return new Map(ENTRIES.map((entry) => [
    entry.packageId,
    Buffer.from(`reviewed:${entry.name}@${entry.version}\n`)
  ]));
}

function preparedRelease() {
  const bytes = tarballs();
  return Object.freeze({
    root: "/tmp/pptx-compiler-alpha-test",
    packagePlan: Object.freeze({ packageVersion: VERSION }),
    releasePlan: Object.freeze({
      recovery: Object.freeze({
        absenceSampling: Object.freeze({
          scope: "read-only-before-each-publish",
          samples: 2,
          delayMilliseconds: 10_000
        })
      }),
      predecessorRelease: Object.freeze({
        version: PREDECESSOR_VERSION,
        tagName: PREDECESSOR_TAG,
        targetCommitOid: PREDECESSOR_HEAD,
        npmProvenance: Object.freeze({ runId: "31665307969", runAttempt: "2" })
      })
    }),
    predecessorReleaseLock: Object.freeze({}),
    repositoryOwnerId: OWNER_ID,
    provenanceRunId: "123",
    provenanceRunAttempt: "1",
    releaseTag: Object.freeze({ headCommitOid: HEAD, tagObjectOid: TAG_OBJECT }),
    publicationOrder: ENTRIES,
    tarballBytes: bytes
  });
}

function metadata(entry, bytes) {
  return {
    name: entry.name,
    version: entry.version,
    dist: {
      tarball: `${REGISTRY}${entry.name}/-/${entry.tarball}`,
      integrity: `sha512-${digest("sha512", bytes, "base64")}`,
      shasum: digest("sha1", bytes),
      signatures: [{ sig: "registry-signature", keyid: "SHA256:registry-key" }],
      attestations: {
        url: `${REGISTRY}-/npm/v1/attestations/${entry.name}@${entry.version}`,
        provenance: { predicateType: "https://slsa.dev/provenance/v1" }
      }
    }
  };
}

function provenanceStatement(entry, bytes, {
  extraDependency = false,
  wrongRef = false,
  runId = "123",
  runAttempt = "1",
  tagName = TAG,
  headCommitOid = HEAD
} = {}) {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{
      name: `pkg:npm/${entry.name}@${entry.version}`,
      digest: { sha512: digest("sha512", bytes) }
    }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            ref: wrongRef ? "refs/heads/main" : `refs/tags/${tagName}`,
            repository: "https://github.com/why7682/pptx-compiler",
            path: ".github/workflows/alpha-release.yml"
          }
        },
        internalParameters: {
          github: {
            event_name: "workflow_dispatch",
            repository_id: "1330979133",
            repository_owner_id: OWNER_ID
          }
        },
        resolvedDependencies: [
          {
            uri: `git+https://github.com/why7682/pptx-compiler@refs/tags/${tagName}`,
            digest: { gitCommit: headCommitOid }
          },
          ...(extraDependency ? [{
            uri: "git+https://github.com/example/foreign@refs/heads/main",
            digest: { gitCommit: "f".repeat(40) }
          }] : [])
        ]
      },
      runDetails: {
        builder: { id: "https://github.com/actions/runner/github-hosted" },
        metadata: {
          invocationId:
            `https://github.com/why7682/pptx-compiler/actions/runs/${runId}/` +
            `attempts/${runAttempt}`
        }
      }
    }
  };
}

function provenanceEnvironment(overrides = {}) {
  return {
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "oidc-token",
    ACTIONS_ID_TOKEN_REQUEST_URL:
      "https://pipelinesghubeus4.actions.githubusercontent.com/example/token?api-version=2.0",
    CI: "true",
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: `refs/tags/${TAG}`,
    GITHUB_REPOSITORY: "why7682/pptx-compiler",
    GITHUB_REPOSITORY_ID: "1330979133",
    GITHUB_REPOSITORY_OWNER_ID: OWNER_ID,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "123",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_SHA: HEAD,
    GITHUB_WORKFLOW_REF:
      `why7682/pptx-compiler/.github/workflows/alpha-release.yml@refs/tags/${TAG}`,
    NODE_AUTH_TOKEN: "npm-secret",
    RUNNER_ENVIRONMENT: "github-hosted",
    ...overrides
  };
}

function attestations(entry, bytes, options = {}) {
  const statement = provenanceStatement(entry, bytes, options);
  const signature = {
    keyid: options.keyedBundle ? "SHA256:foreign-key" : "",
    sig: Buffer.from("synthetic-keyless-signature").toString("base64")
  };
  const verificationMaterial = options.missingCertificate
    ? { tlogEntries: [{}], timestampVerificationData: { rfc3161Timestamps: [] } }
    : options.publicKeyBundle
      ? {
          publicKey: { hint: "SHA256:foreign-key" },
          tlogEntries: [{}],
          timestampVerificationData: { rfc3161Timestamps: [] }
        }
      : {
          certificate: {
            rawBytes: Buffer.from("synthetic-keyless-certificate").toString("base64")
          },
          tlogEntries: [{}],
          timestampVerificationData: { rfc3161Timestamps: [] }
        };
  const provenance = {
    predicateType: "https://slsa.dev/provenance/v1",
    bundle: {
      mediaType: options.legacyBundle
        ? "application/vnd.dev.sigstore.bundle+json;version=0.2"
        : "application/vnd.dev.sigstore.bundle.v0.3+json",
      dsseEnvelope: {
        payloadType: "application/vnd.in-toto+json",
        payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
        signatures: options.multipleSignatures
          ? [signature, { ...signature }]
          : [signature]
      },
      verificationMaterial
    }
  };
  return {
    attestations: options.duplicateProvenance
      ? [provenance, structuredClone(provenance)]
      : [provenance]
  };
}

function pendingPublishAttestations(entry, bytes) {
  const keyHint = `SHA256:${Buffer.alloc(32, 7).toString("base64")}`;
  const statement = {
    _type: "https://in-toto.io/Statement/v0.1",
    subject: [{
      name: `pkg:npm/${entry.name}@${entry.version}`,
      digest: { sha512: digest("sha512", bytes) }
    }],
    predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
    predicate: {
      name: entry.name,
      version: entry.version,
      registry: "https://registry.npmjs.org"
    }
  };
  return {
    attestations: [{
      predicateType:
        "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
      signedAccessSignatureUrl: "",
      bundle: {
        mediaType: "application/vnd.dev.sigstore.bundle+json;version=0.2",
        dsseEnvelope: {
          payloadType: "application/vnd.in-toto+json",
          payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
          signatures: [{
            sig: Buffer.from("pending-publish-signature").toString("base64"),
            keyid: keyHint
          }]
        },
        verificationMaterial: {
          publicKey: { hint: keyHint },
          tlogEntries: [{
            logIndex: "1",
            logId: { keyId: Buffer.alloc(32, 8).toString("base64") },
            kindVersion: { kind: "dsse", version: "0.0.1" },
            integratedTime: "1",
            inclusionPromise: {
              signedEntryTimestamp: Buffer.from("entry").toString("base64")
            },
            inclusionProof: {
              logIndex: "1",
              rootHash: Buffer.alloc(32, 9).toString("base64"),
              treeSize: "2",
              hashes: [Buffer.alloc(32, 10).toString("base64")],
              checkpoint: { envelope: "rekor.example - 1\n2\nroot\n" }
            },
            canonicalizedBody: Buffer.from("canonical-entry").toString("base64")
          }],
          timestampVerificationData: { rfc3161Timestamps: [] }
        }
      }
    }]
  };
}

function createRegistry({
  prepared = preparedRelease(),
  initiallyAbsent = [],
  mismatch = [],
  wrongProvenance = [],
  extraDependencies = [],
  legacyBundle = [],
  duplicateProvenance = [],
  keyedBundle = [],
  publicKeyBundle = [],
  missingCertificate = [],
  multipleSignatures = [],
  badDistTag = [],
  latestAssigned = [],
  preexistingAlpha = [],
  provenanceRuns = {}
} = {}) {
  const absent = new Set(initiallyAbsent);
  const mismatched = new Set(mismatch);
  const wrong = new Set(wrongProvenance);
  const extraDependency = new Set(extraDependencies);
  const legacy = new Set(legacyBundle);
  const duplicate = new Set(duplicateProvenance);
  const keyed = new Set(keyedBundle);
  const publicKey = new Set(publicKeyBundle);
  const missingCert = new Set(missingCertificate);
  const multiple = new Set(multipleSignatures);
  const badTag = new Set(badDistTag);
  const latest = new Set(latestAssigned);
  const existingAlpha = new Set(preexistingAlpha);
  const published = new Set();
  const requests = [];
  const byVersionPath = new Map(ENTRIES.map((entry) => [
    `/${entry.name}/${entry.version}`,
    entry
  ]));
  const byTarballPath = new Map(ENTRIES.map((entry) => [
    `/${entry.name}/-/${entry.tarball}`,
    entry
  ]));
  const byAttestationPath = new Map(ENTRIES.map((entry) => [
    `/-/npm/v1/attestations/${entry.name}@${entry.version}`,
    entry
  ]));
  const byPackagePath = new Map(ENTRIES.map((entry) => [`/${entry.name}`, entry]));
  const fetch = async (input, options) => {
    const url = new URL(input);
    requests.push({ url: url.href, options });
    const versionEntry = byVersionPath.get(url.pathname);
    if (versionEntry !== undefined) {
      if (absent.has(versionEntry.packageId) && !published.has(versionEntry.packageId)) {
        return new Response(null, { status: 404 });
      }
      return jsonResponse(metadata(
        versionEntry,
        prepared.tarballBytes.get(versionEntry.packageId)
      ));
    }
    const tarballEntry = byTarballPath.get(url.pathname);
    if (tarballEntry !== undefined) {
      const bytes = mismatched.has(tarballEntry.packageId)
        ? Buffer.from("foreign-registry-bytes\n")
        : prepared.tarballBytes.get(tarballEntry.packageId);
      return new Response(bytes, {
        status: 200,
        headers: {
          "content-length": String(bytes.length),
          "content-type": "application/octet-stream"
        }
      });
    }
    const attestationEntry = byAttestationPath.get(url.pathname);
    if (attestationEntry !== undefined) {
      return jsonResponse(attestations(
        attestationEntry,
        prepared.tarballBytes.get(attestationEntry.packageId),
        {
          wrongRef: wrong.has(attestationEntry.packageId),
          extraDependency: extraDependency.has(attestationEntry.packageId),
          legacyBundle: legacy.has(attestationEntry.packageId),
          duplicateProvenance: duplicate.has(attestationEntry.packageId),
          keyedBundle: keyed.has(attestationEntry.packageId),
          publicKeyBundle: publicKey.has(attestationEntry.packageId),
          missingCertificate: missingCert.has(attestationEntry.packageId),
          multipleSignatures: multiple.has(attestationEntry.packageId),
          ...(provenanceRuns[attestationEntry.packageId] ?? {})
        }
      ));
    }
    const packageEntry = byPackagePath.get(url.pathname);
    if (packageEntry !== undefined) {
      if (absent.has(packageEntry.packageId) && !published.has(packageEntry.packageId)) {
        if (packageEntry.packageId !== "core") {
          if (!latest.has(packageEntry.packageId) &&
              !existingAlpha.has(packageEntry.packageId)) {
            return new Response(null, { status: 404 });
          }
          const foreignTags = {};
          if (latest.has(packageEntry.packageId)) foreignTags.latest = "0.0.1";
          if (existingAlpha.has(packageEntry.packageId)) foreignTags.alpha = "0.0.1";
          return jsonResponse({
            name: packageEntry.name,
            "dist-tags": foreignTags,
            versions: { "0.0.1": {} }
          });
        }
        return jsonResponse({
          name: packageEntry.name,
          "dist-tags": {
            alpha: existingAlpha.has("core") ? "0.0.1" : PREDECESSOR_VERSION,
            latest: latest.has("core") ? "0.0.1" : PREDECESSOR_VERSION
          },
          versions: { [PREDECESSOR_VERSION]: {} }
        });
      }
      const tags = {
        alpha: badTag.has(packageEntry.packageId) ? "0.0.0" : VERSION
      };
      tags.latest = latest.has(packageEntry.packageId)
        ? "0.0.1"
        : packageEntry.packageId === "core" ? PREDECESSOR_VERSION : VERSION;
      return jsonResponse({
        name: packageEntry.name,
        "dist-tags": tags,
        versions: packageEntry.packageId === "core"
          ? { [PREDECESSOR_VERSION]: {}, [VERSION]: {} }
          : { [VERSION]: {} }
      });
    }
    throw new Error(`unexpected registry URL: ${url.href}`);
  };
  return {
    fetch,
    published,
    requests,
    publishTarball: async ({ entry }) => {
      published.add(entry.packageId);
    }
  };
}

function createPredecessorRegistry({
  currentVersionPresent = false,
  provenance = {},
  tarballBytes = Buffer.from("synthetic locked predecessor bytes\n"),
  mutateMetadata,
  mutatePackument,
  mutateAttestations
} = {}) {
  const entry = {
    packageId: "core",
    name: "pptx-compiler-core",
    version: PREDECESSOR_VERSION,
    tarball: `pptx-compiler-core-${PREDECESSOR_VERSION}.tgz`
  };
  const locked = Object.freeze({
    packageId: entry.packageId,
    name: entry.name,
    tarball: entry.tarball,
    sha256: digest("sha256", tarballBytes),
    sha512: digest("sha512", tarballBytes),
    compressedBytes: tarballBytes.length,
    tarSha256: "0".repeat(64),
    tarBytes: 1
  });
  const requests = [];
  const fetch = async (input) => {
    const url = new URL(input);
    requests.push(url.href);
    if (url.pathname === `/${entry.name}/${entry.version}`) {
      const value = metadata(entry, tarballBytes);
      mutateMetadata?.(value);
      return jsonResponse(value);
    }
    if (url.pathname === `/${entry.name}/-/${entry.tarball}`) {
      return new Response(tarballBytes, { status: 200 });
    }
    if (url.pathname ===
        `/-/npm/v1/attestations/${entry.name}@${entry.version}`) {
      const value = attestations(entry, tarballBytes, {
        tagName: PREDECESSOR_TAG,
        headCommitOid: PREDECESSOR_HEAD,
        runId: "31665307969",
        runAttempt: "2",
        ...provenance
      });
      mutateAttestations?.(value);
      return jsonResponse(value);
    }
    if (url.pathname === `/${entry.name}`) {
      const value = {
        name: entry.name,
        "dist-tags": currentVersionPresent
          ? { alpha: VERSION, latest: PREDECESSOR_VERSION }
          : { alpha: PREDECESSOR_VERSION, latest: PREDECESSOR_VERSION },
        versions: currentVersionPresent
          ? { [PREDECESSOR_VERSION]: {}, [VERSION]: {} }
          : { [PREDECESSOR_VERSION]: {} }
      };
      mutatePackument?.(value);
      return jsonResponse(value);
    }
    throw new Error(`unexpected predecessor registry URL: ${url.href}`);
  };
  return { entry, fetch, locked, requests, tarballBytes };
}

function githubFetch({
  headBranch = TAG,
  mainCommitOid = MAIN_TIP,
  mainCompare,
  tagReferenceOid = TAG_OBJECT,
  tagReferenceType = "tag",
  tagTargetCommitOid = HEAD,
  tagDeleted = false,
  releaseExists = false,
  verified = true,
  repositoryId = 1330979133,
  anonymous = false,
  mainWorkflowConclusion = "success",
  historyGrant = true,
  historyGrantDropsExisting = false,
  attestationExtraFile = false,
  movingMain = false,
  movingTag = false
} = {}) {
  let mainReads = 0;
  let tagReads = 0;
  let requests = 0;
  const fetch = async (input, options) => {
    requests += 1;
    const url = new URL(input);
    if (anonymous) {
      assert.equal(Object.hasOwn(options.headers, "authorization"), false);
    } else {
      assert.equal(options.headers.authorization, "Bearer github-secret");
    }
    if (url.pathname === "/repos/why7682/pptx-compiler") {
      return jsonResponse({
        id: repositoryId,
        full_name: "why7682/pptx-compiler",
        default_branch: "main",
        private: false,
        owner: { id: Number(OWNER_ID) }
      });
    }
    if (url.pathname === "/repos/why7682/pptx-compiler/git/ref/heads/main") {
      mainReads += 1;
      return jsonResponse({
        ref: "refs/heads/main",
        object: {
          type: "commit",
          sha: movingMain && mainReads > 1 ? "d".repeat(40) : mainCommitOid
        }
      });
    }
    if (url.pathname ===
        `/repos/why7682/pptx-compiler/compare/${HEAD}...${mainCommitOid}`) {
      assert.equal(url.searchParams.get("per_page"), "1");
      assert.equal(url.searchParams.get("page"), "1");
      return jsonResponse(mainCompare ?? {
        status: "ahead",
        ahead_by: 1,
        behind_by: 0,
        total_commits: 1,
        merge_base_commit: { sha: HEAD },
        commits: [{ sha: mainCommitOid, parents: [{ sha: HEAD }] }],
        files: attestationExtraFile
          ? [
              { filename: "policy/forbidden-materials.json", status: "modified" },
              { filename: "README.md", status: "modified" }
            ]
          : [{ filename: "policy/forbidden-materials.json", status: "modified" }]
      });
    }
    if (url.pathname ===
        "/repos/why7682/pptx-compiler/contents/policy/forbidden-materials.json") {
      const ref = url.searchParams.get("ref");
      assert.equal([HEAD, mainCommitOid].includes(ref), true);
      const policy = JSON.parse(await readFile(
        path.join(repositoryRoot, "policy/forbidden-materials.json"),
        "utf8"
      ));
      const oldGrant = "8cdf968b72f8dd5f41fee37a68e239e477dec44b";
      policy.approvedGitHubVerifiedMergeCommitObjects = ref === HEAD
        ? [oldGrant]
        : historyGrant
          ? historyGrantDropsExisting ? [HEAD] : [oldGrant, HEAD].sort()
          : [oldGrant];
      const bytes = Buffer.from(`${JSON.stringify(policy, null, 2)}\n`);
      return jsonResponse({
        type: "file",
        name: "forbidden-materials.json",
        path: "policy/forbidden-materials.json",
        sha: "e".repeat(40),
        size: bytes.length,
        encoding: "base64",
        content: bytes.toString("base64")
      });
    }
    if (url.pathname === `/repos/why7682/pptx-compiler/git/ref/tags/${TAG}`) {
      tagReads += 1;
      if (tagDeleted) return new Response(null, { status: 404 });
      return jsonResponse({
        ref: `refs/tags/${TAG}`,
        object: {
          type: tagReferenceType,
          sha: movingTag && tagReads > 1 ? "d".repeat(40) : tagReferenceOid
        }
      });
    }
    if (url.pathname === `/repos/why7682/pptx-compiler/git/tags/${TAG_OBJECT}`) {
      return jsonResponse({
        sha: TAG_OBJECT,
        tag: TAG,
        object: { type: "commit", sha: tagTargetCommitOid }
      });
    }
    if (url.pathname === `/repos/why7682/pptx-compiler/commits/${HEAD}`) {
      return jsonResponse({
        sha: HEAD,
        commit: { verification: { verified, reason: verified ? "valid" : "unsigned" } }
      });
    }
    if (url.pathname === `/repos/why7682/pptx-compiler/releases/tags/${TAG}`) {
      return releaseExists
        ? jsonResponse({ id: 999, tag_name: TAG, draft: true })
        : new Response(null, { status: 404 });
    }
    const workflow = url.pathname.endsWith("/ci.yml/runs")
      ? ".github/workflows/ci.yml"
      : url.pathname.endsWith("/security.yml/runs")
        ? ".github/workflows/security.yml"
        : undefined;
    if (workflow !== undefined) {
      const mainWorkflow = url.searchParams.get("branch") === "main";
      assert.equal([TAG, "main"].includes(url.searchParams.get("branch")), true);
      assert.equal(url.searchParams.get("event"), "push");
      assert.equal(url.searchParams.get("status"), "completed");
      assert.equal(url.searchParams.get("per_page"), "10");
      assert.equal(url.searchParams.get("page"), "1");
      return jsonResponse({
        total_count: 1,
        workflow_runs: [{
          id: workflow.includes("security") ? 102 : 101,
          path: workflow,
          event: "push",
          status: "completed",
          conclusion: mainWorkflow ? mainWorkflowConclusion : "success",
          head_sha: mainWorkflow ? mainCommitOid : HEAD,
          head_branch: mainWorkflow ? "main" : headBranch,
          repository: { id: 1330979133, full_name: "why7682/pptx-compiler" }
        }]
      });
    }
    throw new Error(`unexpected GitHub URL: ${url.href}`);
  };
  fetch.requestCount = () => requests;
  return fetch;
}

function githubAndRegistryFetch(github, registry) {
  return (input, options) => new URL(input).hostname === "api.github.com"
    ? github(input, options)
    : registry.fetch(input, options);
}

test("the publication CLI accepts only the two exact ordered argument vectors", () => {
  assert.equal(parseAlphaPublicationArguments(ARGV.verify).mode, "verify-source");
  assert.equal(parseAlphaPublicationArguments(ARGV.publish).mode, "publish");
  for (const invalid of [
    [],
    ["--mode", "publish"],
    [...ARGV.publish, "--extra"],
    ["--tag", TAG, "--mode", "publish", "--stage-root", ".package-stage/reviewed"],
    ["--mode", "publish", "--tag", "v0.1.0", "--stage-root", ".package-stage/reviewed"]
  ]) {
    assert.throws(() => parseAlphaPublicationArguments(invalid), /alpha-publication-usage/u);
  }

  const script = fileURLToPath(new URL("../scripts/publish-alpha-release.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--mode", "publish"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  assert.equal(result.status, 2);
  assert.deepEqual(JSON.parse(result.stdout).findings, [{
    code: "alpha-publication-usage",
    pointer: ""
  }]);
});

test("verify-source and publish credentials are mutually isolated before preparation", async () => {
  const neverPrepare = async () => assert.fail("credentials must fail before preparation");
  await assert.rejects(() => runAlphaPublication({
    argv: ARGV.verify,
    environment: { GITHUB_TOKEN: "github-secret", NODE_AUTH_TOKEN: undefined },
    dependencies: { prepareRelease: neverPrepare }
  }), /alpha-publication-source-credentials/u);
  await assert.rejects(() => runAlphaPublication({
    argv: ARGV.publish,
    environment: { NODE_AUTH_TOKEN: "npm-secret", GITHUB_TOKEN: undefined },
    dependencies: { prepareRelease: neverPrepare }
  }), /alpha-publication-npm-credentials/u);
  await assert.rejects(() => runAlphaPublication({
    argv: ARGV.publish,
    environment: { NODE_AUTH_TOKEN: "npm-secret", GH_TOKEN: "github-secret" },
    dependencies: { prepareRelease: neverPrepare }
  }), /alpha-publication-npm-credentials/u);
});

test("verify-source reports the exact verified commit without disclosing its token", async () => {
  const prepared = { releaseTag: { headCommitOid: HEAD, tagObjectOid: TAG_OBJECT } };
  const result = await runAlphaPublication({
    argv: ARGV.verify,
    environment: { GITHUB_TOKEN: "github-secret" },
    dependencies: {
      prepareRelease: async () => prepared,
      verifySource: async ({
        headCommitOid,
        tagObjectOid,
        token,
        githubReleaseState
      }) => {
        assert.equal(headCommitOid, HEAD);
        assert.equal(tagObjectOid, TAG_OBJECT);
        assert.equal(token, "github-secret");
        assert.equal(githubReleaseState, "ignore");
        return {
          repositoryId: "1330979133",
          commitOid: HEAD,
          mainTipCommitOid: MAIN_TIP,
          tagTargetRelationToMain: "ancestor",
          workflowRuns: [{ path: ".github/workflows/ci.yml", runId: 101 }]
        };
      },
      finalizeCandidate: async (value) => assert.equal(value, prepared)
    }
  });
  assert.equal(result.commitOid, HEAD);
  assert.equal(result.mainTipCommitOid, MAIN_TIP);
  assert.equal(result.tagTargetRelationToMain, "ancestor");
  assert.equal(result.verified, true);
  assert.equal(JSON.stringify(result).includes("github-secret"), false);
});

test("the credentialed verify-source pre-step remains read-only idempotent after the Release exists", async () => {
  const prepared = preparedRelease();
  const result = await runAlphaPublication({
    argv: ARGV.verify,
    environment: { GITHUB_TOKEN: "github-secret" },
    dependencies: {
      prepareRelease: async () => prepared,
      fetch: githubFetch({ releaseExists: true }),
      finalizeCandidate: async () => true
    }
  });
  assert.equal(result.verified, true);
  assert.equal(result.commitOid, HEAD);
});

test("GitHub source verification binds repository, main ancestry, verified commit, and two tag runs", async () => {
  const result = await verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch()
  });
  assert.equal(result.repositoryId, "1330979133");
  assert.equal(result.commitOid, HEAD);
  assert.equal(result.tagObjectOid, TAG_OBJECT);
  assert.equal(result.mainTipCommitOid, MAIN_TIP);
  assert.equal(result.tagTargetRelationToMain, "ancestor");
  assert.equal(result.repositoryOwnerId, OWNER_ID);
  assert.deepEqual(result.workflowRuns, [
    { path: ".github/workflows/ci.yml", runId: 101 },
    { path: ".github/workflows/security.yml", runId: 102 }
  ]);
  assert.deepEqual(result.mainHistoryWorkflowRun, {
    path: ".github/workflows/ci.yml",
    runId: 101
  });

  const anonymous = await verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    fetchImpl: githubFetch({ anonymous: true })
  });
  assert.equal(anonymous.commitOid, HEAD);

  const existingReleaseAllowed = await verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    githubReleaseState: "ignore",
    fetchImpl: githubFetch({ releaseExists: true })
  });
  assert.equal(existingReleaseAllowed.commitOid, HEAD);
  const anonymousExistingReleaseAllowed = await verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    githubReleaseState: "ignore",
    fetchImpl: githubFetch({ anonymous: true, releaseExists: true })
  });
  assert.equal(anonymousExistingReleaseAllowed.commitOid, HEAD);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    githubReleaseState: "present",
    fetchImpl: githubFetch()
  }), /alpha-publication-github-input/u);

  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ headBranch: "main" })
  }), /alpha-publication-github-workflow/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ verified: false })
  }), /alpha-publication-github-commit/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ repositoryId: 1 })
  }), /alpha-publication-github-repository/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ mainCommitOid: HEAD })
  }), /alpha-publication-github-main-ancestry/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ historyGrant: false })
  }), /alpha-publication-github-history-attestation/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ historyGrantDropsExisting: true })
  }), /alpha-publication-github-history-attestation/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ attestationExtraFile: true })
  }), /alpha-publication-github-main-ancestry/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ mainWorkflowConclusion: "failure" })
  }), /alpha-publication-github-workflow/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ releaseExists: true })
  }), /alpha-publication-github-release-order/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ movingMain: true })
  }), /alpha-publication-github-main-moved/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ movingTag: true })
  }), /alpha-publication-github-tag-moved/u);

  for (const mainCompare of [
    {
      status: "diverged",
      ahead_by: 1,
      behind_by: 1,
      total_commits: 1,
      merge_base_commit: { sha: HEAD },
      commits: [{ sha: MAIN_TIP, parents: [{ sha: HEAD }] }],
      files: [{ filename: "policy/forbidden-materials.json", status: "modified" }]
    },
    {
      status: "behind",
      ahead_by: 0,
      behind_by: 1,
      total_commits: 0,
      merge_base_commit: { sha: MAIN_TIP },
      commits: [],
      files: [{ filename: "policy/forbidden-materials.json", status: "modified" }]
    },
    {
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      merge_base_commit: { sha: "d".repeat(40) },
      commits: [{ sha: MAIN_TIP, parents: [{ sha: HEAD }] }],
      files: [{ filename: "policy/forbidden-materials.json", status: "modified" }]
    },
    {
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      total_commits: 2,
      merge_base_commit: { sha: HEAD },
      commits: [{ sha: MAIN_TIP, parents: [{ sha: HEAD }] }],
      files: [{ filename: "policy/forbidden-materials.json", status: "modified" }]
    },
    {
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      merge_base_commit: { sha: HEAD },
      commits: [{ sha: "e".repeat(40), parents: [{ sha: HEAD }] }],
      files: [{ filename: "policy/forbidden-materials.json", status: "modified" }]
    },
    {
      status: "ahead",
      ahead_by: 65,
      behind_by: 0,
      total_commits: 65,
      merge_base_commit: { sha: HEAD },
      commits: Array.from({ length: 65 }, (_, index) => ({
        sha: index === 64
          ? MAIN_TIP
          : index.toString(16).padStart(40, "0"),
        parents: [{ sha: HEAD }]
      })),
      files: [{ filename: "policy/forbidden-materials.json", status: "modified" }]
    }
  ]) {
    await assert.rejects(() => verifyAlphaGitHubSource({
      headCommitOid: HEAD,
      tagObjectOid: TAG_OBJECT,
      token: "github-secret",
      fetchImpl: githubFetch({ mainCommitOid: MAIN_TIP, mainCompare })
    }), /alpha-publication-github-main-ancestry/u);
  }
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ tagReferenceOid: "c".repeat(40) })
  }), /alpha-publication-github-tag-ref/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ tagReferenceType: "commit" })
  }), /alpha-publication-github-tag-ref/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ tagDeleted: true })
  }), /alpha-publication-github-tag-ref/u);
  await assert.rejects(() => verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    token: "github-secret",
    fetchImpl: githubFetch({ tagTargetCommitOid: "c".repeat(40) })
  }), /alpha-publication-github-tag-object/u);
});

test("mutable GitHub reread is bounded and preserves the admitted source", async () => {
  const fullFetch = githubFetch({ anonymous: true });
  const admitted = await verifyAlphaGitHubSource({
    headCommitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    fetchImpl: fullFetch
  });
  const mutableFetch = githubFetch({ anonymous: true });
  const reread = await verifyMutableAlphaGitHubSource({
    expected: admitted,
    fetchImpl: mutableFetch
  });
  assert.equal(reread.mainTipCommitOid, admitted.mainTipCommitOid);
  assert.equal(reread.tagObjectOid, admitted.tagObjectOid);
  assert.equal(mutableFetch.requestCount(), 7);

  const completedFetch = githubFetch({ anonymous: true, releaseExists: true });
  const completedReread = await verifyMutableAlphaGitHubSource({
    expected: admitted,
    githubReleaseState: "ignore",
    fetchImpl: completedFetch
  });
  assert.equal(completedReread.mainTipCommitOid, admitted.mainTipCommitOid);
  assert.equal(completedFetch.requestCount(), 6);
});

test("npm provenance environment is exact before the first irreversible publish", () => {
  assert.deepEqual(validateAlphaNpmProvenanceEnvironment({
    environment: provenanceEnvironment(),
    headCommitOid: HEAD,
    repositoryOwnerId: OWNER_ID
  }), {
    repositoryOwnerId: OWNER_ID,
    runId: "123",
    runAttempt: "1"
  });
  const publishEnvironment = createAlphaNpmPublishEnvironment({
    ...provenanceEnvironment(),
    NPM_CONFIG_FETCH_RETRIES: "99",
    GITLAB_CI: "true",
    PRIVATE_VALUE: "must-not-cross"
  });
  for (const key of [
    "GITHUB_REPOSITORY_OWNER_ID",
    "RUNNER_ENVIRONMENT",
    "GITHUB_WORKFLOW_REF",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "ACTIONS_ID_TOKEN_REQUEST_URL",
    "ACTIONS_ID_TOKEN_REQUEST_TOKEN"
  ]) {
    assert.equal(publishEnvironment[key], provenanceEnvironment()[key]);
  }
  assert.equal(publishEnvironment.NODE_AUTH_TOKEN, "npm-secret");
  assert.equal(publishEnvironment.NPM_CONFIG_FETCH_RETRIES, "0");
  assert.equal(publishEnvironment.GITLAB_CI, undefined);
  assert.equal(publishEnvironment.PRIVATE_VALUE, undefined);
  for (const oidcUrl of [
    "https://pipelinesghubeus4.actions.githubusercontent.com/example/token?api-version=2.0",
    "https://pipelines.actions.githubusercontent.com/example/token?api-version=2.0"
  ]) {
    assert.doesNotThrow(() => validateAlphaNpmProvenanceEnvironment({
      environment: provenanceEnvironment({
        ACTIONS_ID_TOKEN_REQUEST_URL: oidcUrl
      }),
      headCommitOid: HEAD,
      repositoryOwnerId: OWNER_ID
    }), oidcUrl);
  }
  for (const [key, value] of [
    ["CI", "false"],
    ["GITHUB_ACTIONS", "false"],
    ["GITHUB_SERVER_URL", "https://example.test"],
    ["GITHUB_REPOSITORY", "why7682/other"],
    ["GITHUB_REPOSITORY_ID", "1"],
    ["GITHUB_REPOSITORY_OWNER_ID", "1"],
    ["GITHUB_EVENT_NAME", "push"],
    ["GITHUB_REF", "refs/heads/main"],
    ["GITHUB_SHA", MAIN_TIP],
    ["GITHUB_WORKFLOW_REF", "why7682/pptx-compiler/.github/workflows/ci.yml@main"],
    ["GITHUB_RUN_ID", "01"],
    ["GITHUB_RUN_ATTEMPT", "0"],
    ["RUNNER_ENVIRONMENT", "self-hosted"],
    ["ACTIONS_ID_TOKEN_REQUEST_TOKEN", ""]
  ]) {
    assert.throws(() => validateAlphaNpmProvenanceEnvironment({
      environment: provenanceEnvironment({ [key]: value }),
      headCommitOid: HEAD,
      repositoryOwnerId: OWNER_ID
    }), /alpha-publication-provenance-environment/u, key);
  }
  for (const oidcUrl of [
    "https://actions.githubusercontent.com/example/token",
    "https://evilactions.githubusercontent.com/example/token",
    "https://pipelines.actions.githubusercontent.com.evil/example/token",
    "https://nested.pipelines.actions.githubusercontent.com/example/token",
    "https://\u00e9.actions.githubusercontent.com/example/token",
    "https://xn--9ca.actions.githubusercontent.com/example/token",
    "https://pipelines.actions.githubusercontent.com./example/token",
    "https://pipelines..actions.githubusercontent.com/example/token",
    "https://127.0.0.1/example/token",
    " https://pipelines.actions.githubusercontent.com/example/token",
    "http://pipelines.actions.githubusercontent.com/example/token",
    `https://user${"@"}pipelines.actions.githubusercontent.com/example/token`,
    `https://user:password${"@"}pipelines.actions.githubusercontent.com/example/token`,
    "https://pipelines.actions.githubusercontent.com:443/example/token",
    "https://pipelines.actions.githubusercontent.com/example/token#fragment",
    "https://pipelines.actions.githubusercontent.com/"
  ]) {
    assert.throws(() => validateAlphaNpmProvenanceEnvironment({
      environment: provenanceEnvironment({
        ACTIONS_ID_TOKEN_REQUEST_URL: oidcUrl
      }),
      headCommitOid: HEAD,
      repositoryOwnerId: OWNER_ID
    }), /alpha-publication-provenance-environment/u, oidcUrl);
  }
});

test("the fixed npm Sigstore verifier binds one exact workflow certificate identity", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "pptx-alpha-sigstore-test."));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const canonicalTemporary = await realpath(temporary);
  const npmRoot = path.join(canonicalTemporary, "npm");
  const npmCli = path.join(npmRoot, "bin", "npm-cli.js");
  const sigstoreRoot = path.join(npmRoot, "node_modules", "sigstore");
  const sigstoreModule = path.join(sigstoreRoot, "dist", "index.js");
  const cachePath = path.join(canonicalTemporary, "tuf-cache");
  await Promise.all([
    mkdir(path.dirname(npmCli), { recursive: true }),
    mkdir(path.dirname(sigstoreModule), { recursive: true }),
    mkdir(cachePath, { mode: 0o700 })
  ]);
  await chmod(cachePath, 0o700);
  const certificateIdentity =
    "https://github.com/why7682/pptx-compiler/" +
    ".github/workflows/alpha-release.yml@refs/tags/v0.1.0-alpha.3";
  const certificateIdentityPattern =
    "^https://github\\.com/why7682/pptx-compiler/" +
    "\\.github/workflows/alpha-release\\.yml@refs/tags/" +
    "v0\\.1\\.0-alpha\\.3$";
  const predecessorCertificateIdentity =
    "https://github.com/why7682/pptx-compiler/" +
    ".github/workflows/alpha-release.yml@refs/tags/v0.1.0-alpha.2";
  const predecessorCertificateIdentityPattern =
    "^https://github\\.com/why7682/pptx-compiler/" +
    "\\.github/workflows/alpha-release\\.yml@refs/tags/" +
    "v0\\.1\\.0-alpha\\.2$";
  const certificateIssuer = "https://token.actions.githubusercontent.com";
  await Promise.all([
    writeFile(npmCli, "module.exports = {};\n"),
    writeFile(path.join(sigstoreRoot, "package.json"), `${JSON.stringify({
      name: "sigstore",
      version: "4.1.1",
      main: "dist/index.js"
    })}\n`),
    writeFile(sigstoreModule, `
const identities = new Map([
  [${JSON.stringify(certificateIdentityPattern)}, ${JSON.stringify(certificateIdentity)}],
  [${JSON.stringify(predecessorCertificateIdentityPattern)}, ${JSON.stringify(predecessorCertificateIdentity)}]
]);
const issuer = ${JSON.stringify(certificateIssuer)};
module.exports = {
  createVerifier: async (options) => {
    const identity = identities.get(options.certificateIdentityURI);
    if (identity === undefined ||
        options.certificateIssuer !== issuer || options.ctLogThreshold !== 1 ||
        options.tlogThreshold !== 1 || options.tufCachePath !== ${JSON.stringify(cachePath)} ||
        options.tufForceCache !== true || options.timeout !== 20000 ||
        options.retry?.retries !== 2) {
      throw new Error("wrong verifier policy");
    }
    return {
      verify: (bundle) => {
        if (bundle.reject) throw new Error("invalid cryptographic bundle");
        return {
          identity: {
            subjectAlternativeName: bundle.foreign ? "https://example.test/foreign" : identity,
            extensions: { issuer: bundle.foreignIssuer ? "https://example.test" : issuer }
          }
        };
      }
    };
  }
};
`)
  ]);
  const verify = await createAlphaSigstoreBundleVerifier({
    runtime: {
      npmCli,
      nodeVersion: "24.19.0",
      npmVersion: "11.17.0"
    },
    cachePath
  });
  assert.equal(await verify({}), true);
  const verifyPredecessor = await createAlphaSigstoreBundleVerifier({
    runtime: {
      npmCli,
      nodeVersion: "24.19.0",
      npmVersion: "11.17.0"
    },
    cachePath,
    tagName: PREDECESSOR_TAG
  });
  assert.equal(await verifyPredecessor({}), true);
  for (const bundle of [
    { reject: true },
    { foreign: true },
    { foreignIssuer: true }
  ]) {
    await assert.rejects(
      () => verify(bundle),
      /alpha-publication-registry-attestations/u
    );
  }

  await writeFile(path.join(sigstoreRoot, "package.json"), `${JSON.stringify({
    name: "sigstore",
    version: "4.1.0",
    main: "dist/index.js"
  })}\n`);
  await assert.rejects(() => createAlphaSigstoreBundleVerifier({
    runtime: {
      npmCli,
      nodeVersion: "24.19.0",
      npmVersion: "11.17.0"
    },
    cachePath
  }), /alpha-publication-sigstore-runtime/u);
});

test("the immutable alpha.2 lock yields only the exact fixed-builder core envelope", () => {
  const lock = parseAlphaReleaseLockBytes(predecessorLockBytes);
  assert.deepEqual(predecessorCoreTarballFromLock(lock), {
    packageId: "core",
    name: "pptx-compiler-core",
    tarball: "pptx-compiler-core-0.1.0-alpha.2.tgz",
    sha256: "ed0cc4a2f66049ed9bd6823544913161377a229e290b70bb5527857520930268",
    sha512: "3aff97b21b51cbb639388b36d907b1e776ac8456bd5c3643350ae64c9eacafe" +
      "ddf6f928f668e4ddf4c7fa5bda8d51b3a0eb3238c6774e13b7b6ef0bdc1e7d1b6",
    compressedBytes: 118488,
    tarSha256: "57216ed09b0bca7da6396d04ecbe784904599bd1a9df352f4d5f4f069c3add63",
    tarBytes: 720896
  });
  const drift = structuredClone(lock);
  drift.builderResults.find(({ nodeVersion }) => nodeVersion === "24.19.0")
    .packages.find(({ packageId }) => packageId === "core").sha256 = "0".repeat(64);
  assert.throws(
    () => predecessorCoreTarballFromLock(drift),
    /alpha-release-predecessor-lock/u
  );
});

test("the alpha.2 predecessor verifier binds bytes, S2, run attempt, tags, certificate, and registry signature", async () => {
  for (const currentVersionPresent of [false, true]) {
    const registry = createPredecessorRegistry({ currentVersionPresent });
    const events = [];
    const verified = await verifyAlphaPredecessorCore({
      prepared: preparedRelease(),
      currentVersionPresent,
      fetchImpl: registry.fetch,
      verifyPredecessorBundle: async () => {
        events.push("certificate-bound-provenance");
        return true;
      },
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      runtime: { npmCli: "/fixed/npm-cli.js" },
      auditRegistry: async ({ publicationOrder }) => {
        events.push("registry-signature-audit");
        assert.deepEqual(publicationOrder, [registry.entry]);
      },
      readLockedPredecessor: () => registry.locked
    });
    assert.deepEqual(events, [
      "certificate-bound-provenance",
      "registry-signature-audit"
    ]);
    assert.deepEqual(verified.provenanceInvocation, {
      runId: "31665307969",
      runAttempt: "2"
    });
    assert.deepEqual(verified.distTags, currentVersionPresent
      ? { alpha: VERSION, latest: PREDECESSOR_VERSION }
      : { alpha: PREDECESSOR_VERSION, latest: PREDECESSOR_VERSION });
  }
});

test("any alpha.2 predecessor drift hard-stops before publication", async () => {
  const cases = [
    {
      name: "locked bytes",
      configure: (registry) => ({
        readLockedPredecessor: () => ({
          ...registry.locked,
          sha256: "0".repeat(64)
        })
      }),
      expected: /alpha-publication-predecessor-tarball-mismatch/u
    },
    {
      name: "S2 source",
      registry: () => createPredecessorRegistry({
        provenance: { headCommitOid: "d".repeat(40) }
      }),
      expected: /alpha-publication-registry-attestations/u
    },
    {
      name: "run attempt",
      registry: () => createPredecessorRegistry({
        provenance: { runAttempt: "3" }
      }),
      expected: /alpha-publication-registry-attestations/u
    },
    {
      name: "closed versions",
      registry: () => createPredecessorRegistry({
        mutatePackument: (value) => { value.versions["9.9.9"] = {}; }
      }),
      expected: /alpha-publication-registry-packument-mismatch/u
    },
    {
      name: "certificate",
      configure: () => ({ verifyPredecessorBundle: async () => false }),
      expected: /alpha-publication-registry-attestations/u
    },
    {
      name: "registry signature",
      configure: () => ({
        auditRegistry: async () => { throw new Error("foreign signature"); }
      }),
      expected: /alpha-publication-predecessor-signature-audit/u
    }
  ];
  for (const testCase of cases) {
    const registry = testCase.registry?.() ?? createPredecessorRegistry();
    let writes = 0;
    await assert.rejects(() => verifyAlphaPredecessorCore({
      prepared: preparedRelease(),
      currentVersionPresent: false,
      fetchImpl: registry.fetch,
      verifyPredecessorBundle: async () => true,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      runtime: { npmCli: "/fixed/npm-cli.js" },
      auditRegistry: async () => true,
      readLockedPredecessor: () => registry.locked,
      ...testCase.configure?.(registry)
    }), testCase.expected, testCase.name);
    assert.equal(writes, 0, testCase.name);
  }
});

test("publication materializes only frozen bytes in a private read-only owned path", async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "pptx-alpha-source-mutation."));
  t.after(async () => rm(temporary, { recursive: true, force: true }));
  const sourcePath = path.join(await realpath(temporary), ENTRIES[0].tarball);
  const reviewedBytes = Buffer.from("reviewed immutable tarball bytes\n");
  await writeFile(sourcePath, reviewedBytes);
  const frozenBytes = Buffer.from(await readFile(sourcePath));
  await writeFile(sourcePath, "mutated stage path bytes\n");

  let ownedPath;
  await withMaterializedAlphaTarball({
    entry: ENTRIES[0],
    reviewedBytes: frozenBytes,
    callback: async (tarballPath) => {
      ownedPath = tarballPath;
      assert.notEqual(tarballPath, sourcePath);
      assert.deepEqual(await readFile(tarballPath), reviewedBytes);
      if (process.platform !== "win32") {
        assert.equal((await lstat(path.dirname(tarballPath))).mode & 0o777, 0o700);
        assert.equal((await lstat(tarballPath)).mode & 0o777, 0o444);
      }
    }
  });
  assert.deepEqual(await readFile(sourcePath), Buffer.from("mutated stage path bytes\n"));
  await assert.rejects(() => lstat(ownedPath), { code: "ENOENT" });
});

test("all-absent publication uses dependency order, keeps CLI last, and rereads all bytes", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
  });
  const published = [];
  const audits = [];
  const result = await executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: registry.fetch,
    publishTarball: async (input) => {
      const { entry, reviewedBytes } = input;
      assert.equal(Object.hasOwn(input, "tarballPath"), false);
      assert.equal(reviewedBytes, prepared.tarballBytes.get(entry.packageId));
      published.push(entry.packageId);
      registry.published.add(entry.packageId);
    },
    auditRegistry: async ({ publicationOrder }) => {
      audits.push(publicationOrder.map((entry) => entry.packageId));
    },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  });
  assert.deepEqual(published, ["core", "native-card-arrow", "public-synthetic", "cli"]);
  assert.equal(published.at(-1), "cli");
  assert.deepEqual(audits, [
    ["core"],
    ["core", "native-card-arrow"],
    ["core", "native-card-arrow", "public-synthetic"],
    ["core", "native-card-arrow", "public-synthetic", "cli"],
    ["core", "native-card-arrow", "public-synthetic", "cli"]
  ]);
  assert.equal(result.packages.every((entry) => entry.action === "published"), true);
  assert.equal(result.finalRegistryVerification.length, 4);
  assert.equal(result.githubReleaseCreated, false);
});

test("stable absence is separated by 10s and fresh checks immediately precede the second sample and sole publish", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
  });
  const events = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    if (url.pathname === `/${ENTRIES[0].name}/${VERSION}`) {
      events.push("core-version-read");
    }
    return registry.fetch(input, options);
  };
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl,
    verifyPredecessor: async () => { events.push("fresh-alpha2"); },
    beforePublish: async () => { events.push("fresh-source"); },
    wait: async (milliseconds) => { events.push(`wait:${milliseconds}`); },
    publishTarball: async ({ entry }) => {
      events.push(`publish:${entry.packageId}`);
      registry.published.add(entry.packageId);
    },
    auditRegistry: async () => { throw new Error("stop-after-core"); },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /stop-after-core/u);
  const publishIndex = events.indexOf("publish:core");
  assert.notEqual(publishIndex, -1);
  assert.deepEqual(events.slice(publishIndex - 5, publishIndex + 1), [
    "wait:10000",
    "fresh-source",
    "core-version-read",
    "fresh-alpha2",
    "core-version-read",
    "publish:core"
  ]);
  assert.equal(events.filter((value) => value === "publish:core").length, 1);
});

test("a nonzero npm publish is read-only recovered exactly once or stops outcome-uncertain", async () => {
  {
    const prepared = preparedRelease();
    const registry = createRegistry({
      prepared,
      initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
    });
    const publishCounts = new Map();
    const result = await executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl: registry.fetch,
      publishTarball: async ({ entry }) => {
        publishCounts.set(entry.packageId, (publishCounts.get(entry.packageId) ?? 0) + 1);
        registry.published.add(entry.packageId);
        if (entry.packageId === "core") {
          throw new Error("alpha-publication-npm-publish-outcome-uncertain");
        }
      },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    });
    assert.equal(publishCounts.get("core"), 1);
    assert.equal(result.packages[0].action, "recovered-after-uncertain");
  }

  {
    const prepared = preparedRelease();
    const registry = createRegistry({
      prepared,
      initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
    });
    let publishes = 0;
    const waits = [];
    await assert.rejects(() => executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl: registry.fetch,
      publishTarball: async () => {
        publishes += 1;
        throw new Error("alpha-publication-npm-publish-outcome-uncertain");
      },
      wait: async (milliseconds) => { waits.push(milliseconds); },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    }), /alpha-publication-npm-publish-outcome-uncertain/u);
    assert.equal(publishes, 1);
    assert.deepEqual(waits, Array(7).fill(10_000));
    assert.equal(registry.requests.some(({ url }) =>
      url.includes("native-card-arrow")), true);
    assert.equal(registry.published.size, 0);
  }
});

test("post-publish stabilization retries only exact missing auxiliary state", async () => {
  for (const missing of ["registry-signature", "publish-attestation", "stale-core-packument"]) {
    const prepared = preparedRelease();
    const registry = createRegistry({
      prepared,
      initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
    });
    let injected = false;
    const waits = [];
    const fetchImpl = async (input, options) => {
      const url = new URL(input);
      const corePublished = registry.published.has("core");
      if (!injected && corePublished && missing === "registry-signature" &&
          url.pathname === `/${ENTRIES[0].name}/${VERSION}`) {
        injected = true;
        const value = metadata(ENTRIES[0], prepared.tarballBytes.get("core"));
        delete value.dist.signatures;
        return jsonResponse(value);
      }
      if (!injected && corePublished && missing === "publish-attestation" &&
          url.pathname === `/-/npm/v1/attestations/${ENTRIES[0].name}@${VERSION}`) {
        injected = true;
        return jsonResponse(pendingPublishAttestations(
          ENTRIES[0],
          prepared.tarballBytes.get("core")
        ));
      }
      if (!injected && corePublished && missing === "stale-core-packument" &&
          url.pathname === `/${ENTRIES[0].name}`) {
        injected = true;
        return jsonResponse({
          name: ENTRIES[0].name,
          "dist-tags": {
            alpha: PREDECESSOR_VERSION,
            latest: PREDECESSOR_VERSION
          },
          versions: { [PREDECESSOR_VERSION]: {} }
        });
      }
      return registry.fetch(input, options);
    };
    const result = await executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl,
      publishTarball: registry.publishTarball,
      wait: async (milliseconds) => { waits.push(milliseconds); },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    });
    assert.equal(injected, true, missing);
    assert.equal(result.packages.length, 4, missing);
    assert.deepEqual(waits, Array(5).fill(10_000), missing);
  }
});

test("malformed or foreign attestation visibility hard-stops without waiting or touching the next publish", async () => {
  const malformedValues = [
    { attestations: [null] },
    { attestations: [{ predicateType: "https://example.test/foreign" }] },
    (() => {
      const value = pendingPublishAttestations(ENTRIES[0], tarballs().get("core"));
      value.attestations[0].bundle.dsseEnvelope.signatures[0].keyid =
        `SHA256:${Buffer.alloc(32, 11).toString("base64")}`;
      return value;
    })(),
    (() => {
      const value = pendingPublishAttestations(ENTRIES[0], tarballs().get("core"));
      value.attestations.push({ predicateType: "https://example.test/extra" });
      return value;
    })()
  ];
  for (const malformed of malformedValues) {
    const prepared = preparedRelease();
    const registry = createRegistry({
      prepared,
      initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
    });
    const waits = [];
    const publishes = [];
    const fetchImpl = async (input, options) => {
      const url = new URL(input);
      if (registry.published.has("core") &&
          url.pathname === `/-/npm/v1/attestations/${ENTRIES[0].name}@${VERSION}`) {
        return jsonResponse(malformed);
      }
      return registry.fetch(input, options);
    };
    await assert.rejects(() => executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl,
      publishTarball: async ({ entry }) => {
        publishes.push(entry.packageId);
        registry.published.add(entry.packageId);
      },
      wait: async (milliseconds) => { waits.push(milliseconds); },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    }), /alpha-publication-registry-attestations/u);
    assert.deepEqual(publishes, ["core"]);
    assert.deepEqual(waits, [10_000]);
  }
});

test("a 200 null version response is malformed rather than retryable propagation", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
  });
  const waits = [];
  const publishes = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    if (registry.published.has("core") &&
        url.pathname === `/${ENTRIES[0].name}/${VERSION}`) {
      return jsonResponse(null);
    }
    return registry.fetch(input, options);
  };
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl,
    publishTarball: async ({ entry }) => {
      publishes.push(entry.packageId);
      registry.published.add(entry.packageId);
    },
    wait: async (milliseconds) => { waits.push(milliseconds); },
    auditRegistry: async () => true,
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /alpha-publication-registry-metadata/u);
  assert.deepEqual(publishes, ["core"]);
  assert.deepEqual(waits, [10_000]);
});

test("an exact registry restart republishes nothing and still performs signature audit", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({ prepared });
  let publishes = 0;
  let audits = 0;
  const cryptographicallyVerified = [];
  const result = await executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: registry.fetch,
    publishTarball: async () => { publishes += 1; },
    auditRegistry: async () => { audits += 1; },
    verifyProvenanceBundle: async (bundle) => {
      cryptographicallyVerified.push(bundle);
      return true;
    },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  });
  assert.equal(publishes, 0);
  assert.equal(audits, 2);
  assert.equal(cryptographicallyVerified.length, 28);
  assert.equal(cryptographicallyVerified.every((bundle) =>
    bundle.mediaType === "application/vnd.dev.sigstore.bundle.v0.3+json"), true);
  assert.equal(
    registry.requests.filter(({ url }) =>
      url.includes("/-/npm/v1/attestations/")).length,
    cryptographicallyVerified.length
  );
  assert.equal(result.packages.every((entry) => entry.action === "present-equal"), true);
});

test("an exact read-only restart needs no retired npm token, while an absent version cannot publish without it", async () => {
  {
    const prepared = preparedRelease();
    const registry = createRegistry({ prepared });
    let publishes = 0;
    const result = await executeAlphaRegistryPublication({
      prepared,
      environment: {},
      fetchImpl: registry.fetch,
      publishTarball: async () => { publishes += 1; },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    });
    assert.equal(result.packages.every(({ action }) => action === "present-equal"), true);
    assert.equal(publishes, 0);
  }
  {
    const prepared = preparedRelease();
    const registry = createRegistry({
      prepared,
      initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
    });
    let publishes = 0;
    await assert.rejects(() => executeAlphaRegistryPublication({
      prepared,
      environment: {},
      fetchImpl: registry.fetch,
      publishTarball: async () => { publishes += 1; },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    }), /alpha-publication-npm-credentials/u);
    assert.equal(publishes, 0);
  }
});

test("partial publication continues only for absent packages in the same fixed order", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ["native-card-arrow", "public-synthetic", "cli"],
    provenanceRuns: { core: { runId: "111", runAttempt: "1" } }
  });
  const published = [];
  const result = await executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: registry.fetch,
    publishTarball: async ({ entry }) => {
      published.push(entry.packageId);
      registry.published.add(entry.packageId);
    },
    auditRegistry: async () => true,
    runtime: { npmCli: "/fixed/npm-cli.js" }
  });
  assert.deepEqual(published, ["native-card-arrow", "public-synthetic", "cli"]);
  assert.deepEqual(result.packages.map((entry) => entry.action), [
    "present-equal", "published", "published", "published"
  ]);
  assert.deepEqual(result.packages[0].provenanceInvocation, {
    runId: "111",
    runAttempt: "1"
  });
});

test("an absent version cannot overwrite an existing alpha or latest dist-tag", async () => {
  for (const options of [
    { preexistingAlpha: ["core"] },
    { latestAssigned: ["core"] }
  ]) {
    const prepared = preparedRelease();
    const registry = createRegistry({
      prepared,
      initiallyAbsent: ["core"],
      ...options
    });
    let publishes = 0;
    await assert.rejects(() => executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl: registry.fetch,
      publishTarball: async () => { publishes += 1; },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    }), /alpha-publication-(?:recovery-order|registry-packument-mismatch)/u);
    assert.equal(publishes, 0);
  }
});

test("later registry conflicts reject the whole batch before the first publish", async () => {
  for (const options of [
    {
      initiallyAbsent: ENTRIES.map((entry) => entry.packageId),
      latestAssigned: ["cli"]
    },
    {
      initiallyAbsent: ["core", "native-card-arrow", "public-synthetic"],
      mismatch: ["cli"]
    }
  ]) {
    const prepared = preparedRelease();
    const registry = createRegistry({ prepared, ...options });
    let publishes = 0;
    await assert.rejects(() => executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl: registry.fetch,
      publishTarball: async () => { publishes += 1; },
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    }), /alpha-publication-(?:registry-packument-mismatch|registry-tarball-mismatch|recovery-order)/u);
    assert.equal(publishes, 0);
  }
});

test("a completed prefix dist-tag drift stops before the next irreversible package", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
  });
  const published = [];
  let nativePackumentReadsAfterPublish = 0;
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    if (registry.published.has("native-card-arrow") &&
        url.pathname === `/${ENTRIES[1].name}`) {
      nativePackumentReadsAfterPublish += 1;
      if (nativePackumentReadsAfterPublish >= 2) {
        return jsonResponse({
          name: ENTRIES[1].name,
          "dist-tags": { alpha: "9.9.9", latest: VERSION },
          versions: { [VERSION]: {} }
        });
      }
    }
    return registry.fetch(input, options);
  };
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl,
    publishTarball: async ({ entry }) => {
      published.push(entry.packageId);
      registry.published.add(entry.packageId);
    },
    auditRegistry: async () => true,
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /alpha-publication-registry-packument-mismatch/u);
  assert.deepEqual(published, ["core", "native-card-arrow"]);
});

test("a present byte mismatch hard-stops before any later package or audit", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({ prepared, mismatch: ["core"] });
  let publishes = 0;
  let audits = 0;
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: registry.fetch,
    publishTarball: async () => { publishes += 1; },
    auditRegistry: async () => { audits += 1; },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /alpha-publication-registry-tarball-mismatch/u);
  assert.equal(publishes, 0);
  assert.equal(audits, 0);
  assert.equal(registry.requests.some(({ url }) => url.includes("native-card-arrow")), false);
});

test("the first package signature-audit failure prevents touching the second package", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
  });
  const audited = [];
  const published = [];
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: registry.fetch,
    publishTarball: async ({ entry }) => {
      published.push(entry.packageId);
      registry.published.add(entry.packageId);
    },
    auditRegistry: async ({ publicationOrder }) => {
      audited.push(publicationOrder.map((entry) => entry.packageId));
      throw new Error("alpha-publication-signature-audit");
    },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /alpha-publication-signature-audit/u);
  assert.deepEqual(audited, [["core"]]);
  assert.deepEqual(published, ["core"]);
});

test("provenance binding, alpha dist-tag, and signature audit each fail closed", async () => {
  for (const [options, expected] of [
    [{ wrongProvenance: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ extraDependencies: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ legacyBundle: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ duplicateProvenance: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ keyedBundle: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ publicKeyBundle: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ missingCertificate: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ multipleSignatures: ["core"] }, /alpha-publication-registry-attestations/u],
    [{ badDistTag: ["core"] }, /alpha-publication-registry-packument-mismatch/u],
    [{ latestAssigned: ["core"] }, /alpha-publication-registry-packument-mismatch/u]
  ]) {
    const prepared = preparedRelease();
    const registry = createRegistry({ prepared, ...options });
    await assert.rejects(() => executeAlphaRegistryPublication({
      prepared,
      environment: { NODE_AUTH_TOKEN: "npm-secret" },
      fetchImpl: registry.fetch,
      publishTarball: registry.publishTarball,
      auditRegistry: async () => true,
      runtime: { npmCli: "/fixed/npm-cli.js" }
    }), expected);
  }

  const prepared = preparedRelease();
  const cryptographicRegistry = createRegistry({ prepared });
  let cryptographicCalls = 0;
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: cryptographicRegistry.fetch,
    publishTarball: cryptographicRegistry.publishTarball,
    auditRegistry: async () => true,
    verifyProvenanceBundle: async () => {
      cryptographicCalls += 1;
      throw new Error("foreign certificate");
    },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /alpha-publication-registry-attestations/u);
  assert.equal(cryptographicCalls, 1);
  assert.equal(cryptographicRegistry.requests.some(({ url }) =>
    url.includes("native-card-arrow")), false);

  const auditRegistry = createRegistry({ prepared });
  await assert.rejects(() => executeAlphaRegistryPublication({
    prepared,
    environment: { NODE_AUTH_TOKEN: "npm-secret" },
    fetchImpl: auditRegistry.fetch,
    publishTarball: auditRegistry.publishTarball,
    auditRegistry: async () => {
      throw new Error("alpha-publication-signature-audit");
    },
    runtime: { npmCli: "/fixed/npm-cli.js" }
  }), /alpha-publication-signature-audit/u);
});

test("publish anonymously revalidates GitHub before the fixed npm runtime or registry", async () => {
  const calls = [];
  await assert.rejects(() => runAlphaPublication({
    argv: ARGV.publish,
    environment: provenanceEnvironment(),
    dependencies: {
      prepareRelease: async () => {
        calls.push("prepare");
        return { releaseTag: { headCommitOid: HEAD, tagObjectOid: TAG_OBJECT } };
      },
      verifySource: async (input) => {
        calls.push("anonymous-source");
        assert.equal(Object.hasOwn(input, "token"), false);
        assert.equal(input.tagObjectOid, TAG_OBJECT);
        assert.equal(input.githubReleaseState, "ignore");
        return {
          repositoryId: "1330979133",
          repositoryOwnerId: OWNER_ID,
          commitOid: HEAD
        };
      },
      finalizeCandidate: async () => { calls.push("candidate"); },
      assertRuntime: async () => {
        calls.push("runtime");
        throw new Error("alpha-publication-npm-version");
      },
      fetch: async () => assert.fail("registry must not be reached")
    }
  }), /alpha-publication-npm-version/u);
  assert.deepEqual(calls, ["prepare", "anonymous-source", "candidate", "runtime"]);
});

test("publish revalidates the exact GitHub source after registry completion", async () => {
  const prepared = preparedRelease();
  const source = {
    repositoryId: "1330979133",
    repositoryOwnerId: OWNER_ID,
    repository: "why7682/pptx-compiler",
    defaultBranch: "main",
    mainTipCommitOid: MAIN_TIP,
    tagTargetRelationToMain: "ancestor",
    commitOid: HEAD,
    tagObjectOid: TAG_OBJECT,
    verified: true,
    verificationReason: "valid",
    workflowRuns: []
  };
  const calls = [];
  const result = await runAlphaPublication({
    argv: ARGV.publish,
    environment: provenanceEnvironment(),
    dependencies: {
      prepareRelease: async () => prepared,
      verifySource: async () => {
        calls.push("source");
        return source;
      },
      finalizeCandidate: async () => calls.push("candidate"),
      verifyMutableSource: async ({ expected, githubReleaseState }) => {
        calls.push(`mutable-source:${githubReleaseState}`);
        return expected;
      },
      assertRuntime: async () => ({ npmCli: "/fixed/npm-cli.js" }),
      executePublication: async ({ prepared: value }) => {
        calls.push("registry");
        assert.equal(value.repositoryOwnerId, OWNER_ID);
        assert.equal(value.provenanceRunId, "123");
        assert.equal(value.provenanceRunAttempt, "1");
        return { ok: true };
      }
    }
  });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [
    "source", "candidate", "registry", "mutable-source:ignore"
  ]);

  await assert.rejects(() => runAlphaPublication({
    argv: ARGV.publish,
    environment: provenanceEnvironment(),
    dependencies: {
      prepareRelease: async () => prepared,
      verifySource: async () => source,
      verifyMutableSource: async () => ({
        ...source,
        mainTipCommitOid: "d".repeat(40)
      }),
      finalizeCandidate: async () => true,
      assertRuntime: async () => ({ npmCli: "/fixed/npm-cli.js" }),
      executePublication: async () => ({ ok: true })
    }
  }), /alpha-publication-github-source-moved/u);
});

test("the complete publish lane is read-only idempotent with an existing Release and no retired token", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({ prepared });
  const github = githubFetch({ anonymous: true, releaseExists: true });
  const environment = provenanceEnvironment();
  delete environment.NODE_AUTH_TOKEN;
  let publishes = 0;
  const result = await runAlphaPublication({
    argv: ARGV.publish,
    environment,
    dependencies: {
      prepareRelease: async () => prepared,
      finalizeCandidate: async () => true,
      assertRuntime: async () => ({ npmCli: "/fixed/npm-cli.js" }),
      executePublication: executeAlphaRegistryPublication,
      fetch: githubAndRegistryFetch(github, registry),
      publishTarball: async () => { publishes += 1; },
      auditRegistry: async () => true
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.packages.every(({ action }) => action === "present-equal"), true);
  assert.equal(publishes, 0);
});

test("an existing Release blocks an absent package before token admission or any npm write", async () => {
  const prepared = preparedRelease();
  const registry = createRegistry({
    prepared,
    initiallyAbsent: ENTRIES.map((entry) => entry.packageId)
  });
  const github = githubFetch({ anonymous: true, releaseExists: true });
  const environment = provenanceEnvironment();
  delete environment.NODE_AUTH_TOKEN;
  let publishes = 0;
  await assert.rejects(() => runAlphaPublication({
    argv: ARGV.publish,
    environment,
    dependencies: {
      prepareRelease: async () => prepared,
      finalizeCandidate: async () => true,
      assertRuntime: async () => ({ npmCli: "/fixed/npm-cli.js" }),
      executePublication: executeAlphaRegistryPublication,
      fetch: githubAndRegistryFetch(github, registry),
      publishTarball: async () => { publishes += 1; },
      auditRegistry: async () => true
    }
  }), /alpha-publication-github-release-order/u);
  assert.equal(publishes, 0);
  assert.equal(registry.published.size, 0);
});
