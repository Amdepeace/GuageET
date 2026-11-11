# Monthly curation checklist

Infrastructure records live in `infrastructure.geojson`. Review them once a month.

For each record:

1. Search for news or official updates since its `lastVerified` date (funder pages: AfDB, World Bank, ERC, EEP, KETRACO, Ethiopian Airlines).
2. Update `status`, `summary`, `costUsd`/`costNote` and `funders` if anything changed.
3. Add the new source to `sources` (title + URL). Keep older sources that still support the record.
4. Set `verified` to `false` if sources conflict, are undated, or no current status can be found; `true` only when a recent, dated source supports the status.
5. Set `lastVerified` to today's date (YYYY-MM-DD).

Then run `npm run validate`. It fails if any record has no source URL or a malformed date.

The INFRA status light turns amber when any record is unverified or older than 45 days, and red above 3 unverified records or 90 days.

Map geometry is schematic (paths through the named towns). Only change coordinates if a route changes materially.
