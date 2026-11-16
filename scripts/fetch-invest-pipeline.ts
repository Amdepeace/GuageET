// World Bank projects for Ethiopia (pipeline and active), from the World Bank's
// open projects API. These are PUBLIC-SECTOR development-finance operations
// (loans, grants and results-based programmes to the Government and agencies),
// not private investment offers; they matter to investors as signals of where
// public money and procurement are heading. Sector labels are the Bank's own
// (often blank for pipeline projects); nothing is inferred here.
import { join } from "node:path";
import type { InvestPipelineFile, PipelineProject } from "../lib/schema";
import { DATA, fetchJson, readJson, recordHealth, writeJson } from "./lib/store";

const SOURCE = "World Bank projects (Ethiopia)";
const SOURCE_URL = "https://projects.worldbank.org/en/projects-operations/projects-list?countrycode_exact=ET";
const OUT = join(DATA, "invest-pipeline.json");
const FIELDS = "id,project_name,status,boardapprovaldate,closingdate,totalcommamt,sector1,lendinginstr,impagency,url,pdo";

type Raw = { id: string; project_name?: string; status?: string; boardapprovaldate?: string; closingdate?: string; totalcommamt?: string; sector1?: { Name?: string }; lendinginstr?: string; impagency?: string; url?: string; pdo?: string };

async function load(status: string): Promise<Raw[]> {
  const qs = new URLSearchParams({ format: "json", countrycode_exact: "ET", status_exact: status, rows: "300", fl: FIELDS });
  const d = (await fetchJson(`https://search.worldbank.org/api/v2/projects?${qs}`, 3, 90_000)) as { projects?: Record<string, Raw> };
  return Object.values(d.projects ?? {});
}

const num = (s?: string) => Number((s ?? "0").replace(/[^0-9.]/g, "")) || 0;
const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");

async function main() {
  const fetchedAt = new Date().toISOString();
  const prev = readJson<InvestPipelineFile | null>(OUT, null);
  try {
    const raw = [...(await load("Pipeline")), ...(await load("Active"))];
    if (!raw.length) throw new Error("no projects returned");
    const projects: PipelineProject[] = raw.map((r) => ({
      id: r.id,
      name: (r.project_name ?? "").replace(/\s+/g, " ").trim(),
      status: r.status ?? "",
      approved: day(r.boardapprovaldate),
      closing: day(r.closingdate),
      commitmentUsd: num(r.totalcommamt),
      instrument: r.lendinginstr ?? "",
      agency: (r.impagency ?? "").replace(/\s+/g, " ").trim(),
      sector: r.sector1?.Name ?? "",
      url: r.url ?? `https://projects.worldbank.org/en/projects-operations/project-detail/${r.id}`,
      objective: (r.pdo ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    }));
    projects.sort((a, b) => (a.status === b.status ? b.commitmentUsd - a.commitmentUsd : a.status === "Pipeline" ? -1 : 1));
    writeJson(OUT, {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      fetchedAt,
      available: true,
      note: "Public-sector development finance from the World Bank's open projects API, not private investment offers. Commitment is the amount the Bank lists (0 means not yet stated); pipeline projects can change or drop. Sector labels are the Bank's and are often blank for pipeline projects.",
      projects,
    } satisfies InvestPipelineFile);
    recordHealth(SOURCE, 7, { ok: true });
    console.log(`invest-pipeline: ${projects.length} projects (${projects.filter((p) => p.status === "Pipeline").length} pipeline)`);
  } catch (e) {
    recordHealth(SOURCE, 7, { ok: false, error: String((e as Error).message ?? e) });
    if (!prev) writeJson(OUT, { source: SOURCE, sourceUrl: SOURCE_URL, fetchedAt, available: false, note: "Pipeline data has not loaded yet.", projects: [] } satisfies InvestPipelineFile);
    console.error("invest-pipeline failed, keeping last good:", (e as Error).message);
  }
}

main();
