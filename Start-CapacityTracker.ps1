# Serves the tracker on this PC so you can sign in to SharePoint.
# Data stays in lists on the Production site.
$root = $PSScriptRoot
$port = 8765
$url = "http://127.0.0.1:$port/CapacityTracker.html"

if (-not (Test-Path (Join-Path $root "CapacityTracker.html"))) {
  Write-Error "CapacityTracker.html not found next to this script."
  exit 1
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind port $port. Trying 8766..."
  $port = 8766
  $url = "http://127.0.0.1:$port/CapacityTracker.html"
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://127.0.0.1:$port/")
  $listener.Start()
}

Write-Host "Capacity Tracker is running at $url"
Write-Host "Leave this window open. Close it when you are done."
Start-Process $url

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".txt"  = "text/plain; charset=utf-8"
  ".json" = "application/json"
  ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "CapacityTracker.html" }
  $path = Join-Path $root $rel
  $full = [IO.Path]::GetFullPath($path)
  $rootFull = [IO.Path]::GetFullPath($root)
  if (-not $full.StartsWith($rootFull)) {
    $ctx.Response.StatusCode = 403
    $ctx.Response.Close()
    continue
  }
  if (-not (Test-Path $full -PathType Leaf)) {
    $ctx.Response.StatusCode = 404
    $ctx.Response.Close()
    continue
  }
  $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
  $bytes = [IO.File]::ReadAllBytes($full)
  $ctx.Response.ContentType = $mime[$ext]
  if (-not $ctx.Response.ContentType) { $ctx.Response.ContentType = "application/octet-stream" }
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}
