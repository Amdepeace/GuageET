"use client";
import type { HealthStatus, HumanitarianFile } from "@/lib/schema";
import { compact } from "@/lib/format";

export function HumanitarianPanel({ data, status }: { data: HumanitarianFile; status: HealthStatus }) {
  const pin = data.peopleInNeed;
  const ipc = data.ipcPhase3plus;

  return (
    <div className="panel flex flex-col">
      <div className="panel-title flex-wrap">
        <span>HUMANITARIAN · People &amp; conditions</span>
        <span className="grow" />
        <span className={`st ${status}`}>{status}</span>
      </div>

      {!data.available ? (
        <div className="p-4 text-[12.5px] ink2 flex flex-col gap-2">
          <p className="font-semibold" style={{ color: "var(--ink)" }}>
            Humanitarian panel is waiting for a data key.
          </p>
          <p>{data.note}</p>
          <ol className="list-decimal ml-4 flex flex-col gap-1 text-[12px]">
            <li>
              Generate a free app identifier at{" "}
              <a href="https://hapi.humdata.org/docs" target="_blank" rel="noreferrer">
                HDX HAPI ↗
              </a>{" "}
              (an app name + email; no account).
            </li>
            <li>
              Add it as the repo secret <span className="mono">HDX_APP_IDENTIFIER</span>.
            </li>
            <li>Re-run the workflow. People-in-need, food insecurity and staple prices appear here.</li>
          </ol>
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="label">People in need</div>
              <div className="mono text-[20px] font-semibold">{pin ? compact(pin.value) : "—"}</div>
              <div className="text-[10px] muted">
                {pin ? (
                  <>
                    {pin.population ? `of ${compact(pin.population)} people · ` : ""}
                    {pin.period.slice(0, 4)}
                  </>
                ) : (
                  "no data"
                )}
              </div>
            </div>
            <div>
              <div className="label">Food insecurity (IPC 3+)</div>
              <div className="mono text-[20px] font-semibold" style={{ color: ipc ? "var(--warn)" : undefined }}>
                {ipc ? compact(ipc.value) : "—"}
              </div>
              <div className="text-[10px] muted">{ipc ? `crisis or worse · ${ipc.period.slice(0, 4)}` : "no data"}</div>
            </div>
          </div>

          {data.foodPrices.length > 0 && (
            <div>
              <div className="label mb-1">Staple food prices</div>
              <table className="grid text-[12px]">
                <thead>
                  <tr>
                    <th>Commodity</th>
                    <th style={{ textAlign: "right" }}>Price</th>
                    <th>Unit</th>
                    <th style={{ textAlign: "right" }}>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {data.foodPrices.map((p) => (
                    <tr key={p.commodity}>
                      <td>{p.commodity}</td>
                      <td style={{ textAlign: "right" }} className="mono">
                        {p.price.toLocaleString()} {p.currency}
                      </td>
                      <td className="ink2">{p.unit}</td>
                      <td style={{ textAlign: "right" }} className="muted mono">
                        {p.period.slice(0, 7)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="px-3 pb-2 text-[10px] muted flex flex-wrap gap-x-2 mt-auto">
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          {data.source}
        </a>
        <span>· original providers: IPC, WFP, OCHA · each figure dated</span>
      </div>
    </div>
  );
}
