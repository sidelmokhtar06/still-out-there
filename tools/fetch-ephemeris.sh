#!/usr/bin/env bash
# Downloads Earth-to-spacecraft distance tables from NASA JPL Horizons and writes data/*_ephemeris.json.
# Usage: tools/fetch-ephemeris.sh [START] [STOP]     (dates as YYYY-MM-DD)
set -euo pipefail
cd "$(dirname "$0")/.."
START="${1:-2026-11-01}"; STOP="${2:-2029-01-01}"

fetch() { # horizons_id  output_name  label
  curl -sfG 'https://ssd.jpl.nasa.gov/api/horizons.api' \
    --data-urlencode "format=text" --data-urlencode "COMMAND='$1'" \
    --data-urlencode "OBJ_DATA=NO" --data-urlencode "MAKE_EPHEM=YES" \
    --data-urlencode "EPHEM_TYPE=OBSERVER" --data-urlencode "CENTER='500@399'" \
    --data-urlencode "START_TIME='$START'" --data-urlencode "STOP_TIME='$STOP'" \
    --data-urlencode "STEP_SIZE='1 d'" --data-urlencode "QUANTITIES='20'" \
    --data-urlencode "CSV_FORMAT=YES" |
  node -e '
    const [id, label, start] = process.argv.slice(1);
    const text = require("fs").readFileSync(0, "utf8");
    const body = text.split("$$SOE")[1]?.split("$$EOE")[0];
    if (!body) { console.error("Horizons returned no table for " + id + ":\n" + text.slice(0, 600)); process.exit(1); }
    const au = body.trim().split("\n").map((l) => Number(l.split(",")[3]));
    if (au.some((v) => !(v > 0))) { console.error("bad row for " + id); process.exit(1); }
    const target = (text.match(/Target body name: (.*?)\s*\{/) || [])[1] || label;
    console.log(JSON.stringify({ target, horizonsId: id, observer: "Earth geocenter (500@399)",
      quantity: "apparent range (delta), AU", source: "NASA JPL Horizons, https://ssd.jpl.nasa.gov/horizons/",
      downloaded: new Date().toISOString().slice(0, 10), start, stepDays: 1, au }));
  ' -- "$1" "$3" "$START" > "data/$2_ephemeris.json"
  echo "wrote data/$2_ephemeris.json"
}

fetch -23  pioneer10 "Pioneer 10"
fetch -227 kepler    "Kepler"
