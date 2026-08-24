#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/app.css"), "utf8");
const scripts = ["js/calc.js", "js/store.js", "js/sharepoint.js", "js/sync.js", "js/auth.js", "js/graph.js", "js/filestore.js", "js/app.js"]
  .map((rel) => fs.readFileSync(path.join(root, rel), "utf8"))
  .join("\n;\n");

function safeStyle(text) {
  return text.replace(/<\/style/gi, "<\\/style");
}

function safeScript(text) {
  return text.replace(/<\/script/gi, "<\\/script");
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Capacity Tracker</title>
  <meta name="description" content="Track work center capacity, people hours, and work order load.">
  <style>
${safeStyle(css)}
  </style>
</head>
<body>
  <div id="app">
    <p style="font-family:Segoe UI,sans-serif;padding:2rem">Loading Capacity Tracker…</p>
  </div>
  <script>
${safeScript(scripts)}
  </script>
</body>
</html>
`;

const out = path.join(root, "CapacityTracker.html");
fs.writeFileSync(out, html);
console.log("Wrote", out, "(" + html.length + " bytes)");
