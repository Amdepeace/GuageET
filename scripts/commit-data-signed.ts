// Commits the refreshed /data files through GitHub's GraphQL API (createCommitOnBranch).
// Commits made this way are signed by GitHub and show as "Verified", unlike commits
// made with `git commit` + `git push` from a runner. Needs GITHUB_TOKEN (contents: write),
// GITHUB_REPOSITORY and GITHUB_REF_NAME, all set by GitHub Actions. DRY_RUN=1 lists the
// changes without committing.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

// "XY path" records separated by NUL; D = deleted, anything else present on disk = add/update
const records = git("status", "--porcelain=v1", "-z", "--untracked-files=all", "data").split("\0").filter(Boolean);
const additions: { path: string; contents: string }[] = [];
const deletions: { path: string }[] = [];
for (const r of records) {
  const code = r.slice(0, 2);
  const path = r.slice(3);
  if (code.includes("D")) deletions.push({ path });
  else additions.push({ path, contents: readFileSync(path).toString("base64") });
}

if (!additions.length && !deletions.length) {
  console.log("No data changes.");
  process.exit(0);
}
console.log(`${additions.length} files changed, ${deletions.length} deleted.`);
if (process.env.DRY_RUN) {
  for (const a of additions) console.log(`  ~ ${a.path}`);
  for (const d of deletions) console.log(`  - ${d.path}`);
  process.exit(0);
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const branch = process.env.GITHUB_REF_NAME;
  if (!token || !repo || !branch) throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_REF_NAME are required");

  const stamp = new Date().toISOString().slice(0, 16) + "Z";
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "ethiopia-vitals-bot" },
    body: JSON.stringify({
      query: "mutation($input: CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid url}}}",
      variables: {
        input: {
          branch: { repositoryNameWithOwner: repo, branchName: branch },
          message: { headline: `data: scheduled refresh ${stamp}` },
          expectedHeadOid: git("rev-parse", "HEAD").trim(),
          fileChanges: { additions, deletions },
        },
      },
    }),
  });
  const body = (await res.json()) as { data?: { createCommitOnBranch?: { commit: { oid: string; url: string } } }; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length || !body.data?.createCommitOnBranch) {
    console.error(`createCommitOnBranch failed: HTTP ${res.status} ${JSON.stringify(body.errors ?? body).slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`Committed ${body.data.createCommitOnBranch.commit.oid} (verified by GitHub): ${body.data.createCommitOnBranch.commit.url}`);

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
