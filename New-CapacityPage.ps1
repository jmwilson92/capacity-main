<#
.SYNOPSIS
  Creates a modern SharePoint page with the four Capacity Tracker lists on it.

.EXAMPLE
  Connect-PnPOnline -Url "https://fuseintegration.sharepoint.us/sites/Production" -Interactive
  .\New-CapacityLists.ps1
  .\New-CapacityPage.ps1
#>
[CmdletBinding()]
param(
  [string]$PageName = "Capacity",
  [string]$WorkCentersList = "CT Work Centers",
  [string]$PeopleList = "CT People",
  [string]$WorkOrdersList = "CT Work Orders",
  [string]$AbsencesList = "CT Time Off"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell) -and -not (Get-Module -Name PnP.PowerShell)) {
  throw "PnP.PowerShell is required. Install it with: Install-Module PnP.PowerShell -Scope CurrentUser"
}

$page = Get-PnPPage -Identity $PageName -ErrorAction SilentlyContinue
if (-not $page) {
  $page = Add-PnPPage -Name $PageName -LayoutType Article -HeaderLayoutType NoImage
  Write-Host "Created page: $PageName"
} else {
  Write-Host "Page already exists: $PageName"
}

Add-PnPPageTextPart -Page $PageName -Text @"
Capacity Tracker — shared lists for this site. Everyone with access sees the same work centers, people, time off, and work orders. The full planning-board app needs IT to approve a custom web part (see IT-REQUEST.txt).
"@ | Out-Null

foreach ($title in @($WorkCentersList, $PeopleList, $WorkOrdersList, $AbsencesList)) {
  $list = Get-PnPList -Identity $title -ErrorAction Stop
  Add-PnPPageWebPart -Page $PageName -DefaultWebPartType List -WebPartProperties @{
    isDocumentLibrary = $false
    selectedListId    = $list.Id.ToString()
    listId            = $list.Id.ToString()
  } | Out-Null
  Write-Host "Added list web part: $title"
}

Set-PnPPage -Identity $PageName -Publish | Out-Null
Write-Host ""
Write-Host "Published. Open Site pages and click $PageName."
