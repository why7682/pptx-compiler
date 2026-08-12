import assert from "node:assert/strict";
import test from "node:test";

import {
  alphaGitHubReleaseRequest,
  createOrVerifyAlphaGitHubRelease,
  parseAlphaGitHubReleaseArguments,
  runAlphaGitHubRelease,
  verifyExactAlphaGitHubRelease
} from "../scripts/create-alpha-github-release.mjs";

const TAG = "v0.1.0-alpha.1";
const HEAD = "a".repeat(40);
const TAG_OBJECT = "b".repeat(40);
const MAIN = "c".repeat(40);
const BODY = "# Locked note\n\n---\n\n## Release identity\n";

function prepared() {
  return Object.freeze({
    releasePlan: Object.freeze({
      githubRelease: Object.freeze({ name: "pptx-compiler 0.1.0-alpha.1" })
    }),
    releaseTag: Object.freeze({
      headCommitOid: HEAD,
      tagObjectOid: TAG_OBJECT
    })
  });
}

function releaseValue(request, overrides = {}) {
  return {
    id: 91,
    tag_name: request.tag_name,
    target_commitish: request.target_commitish,
    name: request.name,
    body: request.body,
    draft: false,
    prerelease: true,
    immutable: false,
    assets: [],
    html_url: "https://github.com/why7682/pptx-compiler/releases/tag/" + TAG,
    ...overrides
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function githubReleaseFetch({
  initial = "absent",
  createStatus = 201,
  drift = {},
  lateDrift = undefined
} = {}) {
  const requests = [];
  let created;
  let releaseReads = 0;
  const fetch = async (input, options = {}) => {
    const url = new URL(input);
    requests.push({ url: url.href, options });
    if (options.method === "POST") {
      const request = JSON.parse(options.body);
      created = releaseValue(request, drift);
      return createStatus === 201
        ? json(created, 201)
        : json({ message: "already_exists" }, 422);
    }
    if (url.pathname.endsWith(`/releases/tags/${TAG}`)) {
      releaseReads += 1;
      if (initial === "present" && created === undefined) {
        const request = {
          tag_name: TAG,
          target_commitish: HEAD,
          name: "pptx-compiler 0.1.0-alpha.1",
          body: BODY
        };
        created = releaseValue(request, drift);
      }
      if (created === undefined && createStatus === 422 && requests.length > 1) {
        const request = JSON.parse(requests.find(({ options: requestOptions }) =>
          requestOptions.method === "POST").options.body);
        created = releaseValue(request, drift);
      }
      if (created === undefined) return json({ message: "Not Found" }, 404);
      return json(releaseReads >= 3 && lateDrift !== undefined
        ? { ...created, ...lateDrift }
        : created);
    }
    throw new Error(`unexpected request ${url.href}`);
  };
  return { fetch, requests };
}

test("GitHub Release arguments and exact request are closed", () => {
  assert.deepEqual(parseAlphaGitHubReleaseArguments([
    "--tag", TAG,
    "--stage-root", ".package-stage/reviewed"
  ]), { tagName: TAG, stageRoot: ".package-stage/reviewed" });
  assert.throws(() => parseAlphaGitHubReleaseArguments([
    "--tag", TAG
  ]), /alpha-github-release-usage/u);
  assert.deepEqual(alphaGitHubReleaseRequest({ prepared: prepared(), body: BODY }), {
    tag_name: TAG,
    target_commitish: HEAD,
    name: "pptx-compiler 0.1.0-alpha.1",
    body: BODY,
    draft: false,
    prerelease: true,
    generate_release_notes: false,
    make_latest: "false"
  });
});

test("Release declaration creates only after 404 and rereads exact state", async () => {
  const fixture = githubReleaseFetch();
  const result = await createOrVerifyAlphaGitHubRelease({
    prepared: prepared(),
    body: BODY,
    token: "github-token",
    fetchImpl: fixture.fetch
  });
  assert.deepEqual({ action: result.action, releaseId: result.releaseId }, {
    action: "created",
    releaseId: 91
  });
  assert.deepEqual(fixture.requests.map(({ options }) => options.method), [
    "GET", "POST", "GET"
  ]);
  const request = JSON.parse(fixture.requests[1].options.body);
  assert.equal(request.draft, false);
  assert.equal(request.prerelease, true);
  assert.equal(request.make_latest, "false");
  assert.equal(request.generate_release_notes, false);
  assert.equal(Object.hasOwn(request, "assets"), false);

  const stopped = githubReleaseFetch();
  await assert.rejects(() => createOrVerifyAlphaGitHubRelease({
    prepared: prepared(),
    body: BODY,
    token: "github-token",
    beforeCreate: async () => {
      assert.equal(stopped.requests.length, 1);
      assert.equal(stopped.requests[0].options.method, "GET");
      throw new Error("source-moved-before-create");
    },
    fetchImpl: stopped.fetch
  }), /source-moved-before-create/u);
  assert.deepEqual(stopped.requests.map(({ options }) => options.method), ["GET"]);
});

test("Release declaration is exact-idempotent and reconciles only a 422 race", async () => {
  const present = githubReleaseFetch({ initial: "present" });
  const reused = await createOrVerifyAlphaGitHubRelease({
    prepared: prepared(), body: BODY, token: "github-token", fetchImpl: present.fetch
  });
  assert.equal(reused.action, "present-exact");
  assert.equal(present.requests.some(({ options }) => options.method === "POST"), false);

  const normalizedTarget = githubReleaseFetch({
    initial: "present",
    drift: { target_commitish: "main" }
  });
  const normalized = await createOrVerifyAlphaGitHubRelease({
    prepared: prepared(), body: BODY, token: "github-token",
    fetchImpl: normalizedTarget.fetch
  });
  assert.equal(normalized.action, "present-exact");

  const race = githubReleaseFetch({ createStatus: 422 });
  const raced = await createOrVerifyAlphaGitHubRelease({
    prepared: prepared(), body: BODY, token: "github-token", fetchImpl: race.fetch
  });
  assert.equal(raced.action, "race-exact");

  const unauthorized = githubReleaseFetch();
  const originalFetch = unauthorized.fetch;
  unauthorized.fetch = async (input, options) => {
    if ((options?.method ?? "GET") === "POST") {
      return json({ message: "forbidden" }, 403);
    }
    return originalFetch(input, options);
  };
  await assert.rejects(() => createOrVerifyAlphaGitHubRelease({
    prepared: prepared(), body: BODY, token: "github-token",
    fetchImpl: unauthorized.fetch
  }), /alpha-github-release-create/u);

  for (const drift of [
    { body: "foreign" },
    { draft: true },
    { prerelease: false },
    { tag_name: "v0.1.0-alpha.2" },
    { assets: [{ id: 1 }] }
  ]) {
    const mismatch = githubReleaseFetch({ initial: "present", drift });
    await assert.rejects(() => createOrVerifyAlphaGitHubRelease({
      prepared: prepared(), body: BODY, token: "github-token", fetchImpl: mismatch.fetch
    }), /alpha-github-release-mismatch/u);
    assert.equal(mismatch.requests.some(({ options }) =>
      ["PATCH", "DELETE"].includes(options.method)), false);
  }

  const moved = githubReleaseFetch({ lateDrift: { body: "changed after declaration" } });
  await createOrVerifyAlphaGitHubRelease({
    prepared: prepared(), body: BODY, token: "github-token", fetchImpl: moved.fetch
  });
  await assert.rejects(() => verifyExactAlphaGitHubRelease({
    prepared: prepared(), body: BODY, token: "github-token", fetchImpl: moved.fetch
  }), /alpha-github-release-mismatch/u);
});

test("orchestration isolates GitHub credentials and verifies source and registry twice", async () => {
  const preparedValue = {
    ...prepared(),
    packagePlan: { packageVersion: "0.1.0-alpha.1" },
    releaseLock: {},
    lockedInputBytes: new Map(),
    publicationOrder: [{ packageId: "core" }],
    tarballBytes: new Map([["core", Buffer.from("tarball")]])
  };
  let sourceCalls = 0;
  let registryCalls = 0;
  let declared = 0;
  let finalReleaseReads = 0;
  const environment = {
    GITHUB_TOKEN: "github-token",
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: `refs/tags/${TAG}`,
    GITHUB_REPOSITORY: "why7682/pptx-compiler"
  };
  const result = await runAlphaGitHubRelease({
    argv: ["--tag", TAG, "--stage-root", ".package-stage/reviewed"],
    environment,
    dependencies: {
      prepareRelease: async () => preparedValue,
      verifySource: async ({ token, githubReleaseState }) => {
        sourceCalls += 1;
        assert.equal(token, "github-token");
        assert.equal(githubReleaseState, "ignore");
        return {
          repositoryId: "1330979133",
          repositoryOwnerId: "1",
          commitOid: HEAD,
          tagObjectOid: TAG_OBJECT,
          mainTipCommitOid: MAIN
        };
      },
      finalizeCandidate: () => {},
      renderBody: () => BODY,
      resolveRuntime: async () => ({ npmCli: "/fixed/npm-cli.js" }),
      verifyRegistry: async () => {
        registryCalls += 1;
        return [{ packageId: "core", sha256: "d".repeat(64) }];
      },
      declareRelease: async ({ token }) => {
        declared += 1;
        assert.equal(token, "github-token");
        return { action: "created", releaseId: 91 };
      },
      verifyDeclaredRelease: async () => {
        finalReleaseReads += 1;
        return { releaseId: 91 };
      }
    }
  });
  assert.equal(result.githubReleaseCreated, true);
  assert.equal(sourceCalls, 3);
  assert.equal(registryCalls, 2);
  assert.equal(declared, 1);
  assert.equal(finalReleaseReads, 1);

  let driftSourceCalls = 0;
  let driftDeclarations = 0;
  await assert.rejects(() => runAlphaGitHubRelease({
    argv: ["--tag", TAG, "--stage-root", ".package-stage/reviewed"],
    environment,
    dependencies: {
      prepareRelease: async () => preparedValue,
      verifySource: async () => {
        driftSourceCalls += 1;
        return {
          repositoryId: "1330979133",
          repositoryOwnerId: "1",
          commitOid: HEAD,
          tagObjectOid: TAG_OBJECT,
          mainTipCommitOid: driftSourceCalls === 1 ? MAIN : "d".repeat(40)
        };
      },
      finalizeCandidate: () => {},
      renderBody: () => BODY,
      resolveRuntime: async () => ({ npmCli: "/fixed/npm-cli.js" }),
      verifyRegistry: async () => [{ packageId: "core" }],
      declareRelease: async () => {
        driftDeclarations += 1;
        return { action: "created", releaseId: 91 };
      }
    }
  }), /alpha-github-release-source-moved/u);
  assert.equal(driftDeclarations, 0);

  for (const leaked of [
    { NODE_AUTH_TOKEN: "npm" },
    { NPM_TOKEN: "npm" },
    { GH_TOKEN: "github" },
    { ACTIONS_ID_TOKEN_REQUEST_TOKEN: "oidc" },
    { ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid" }
  ]) {
    await assert.rejects(() => runAlphaGitHubRelease({
      argv: ["--tag", TAG, "--stage-root", ".package-stage/reviewed"],
      environment: { ...environment, ...leaked },
      dependencies: { prepareRelease: async () => preparedValue }
    }), /alpha-github-release-credentials/u);
  }
});
