<#
.SYNOPSIS
  Creates the SharePoint lists Capacity Tracker expects (work centers, employees, work orders, time off).

.EXAMPLE
  Connect-PnPOnline -Url "https://contoso.sharepoint.com/sites/ops" -Interactive
  .\New-CapacityLists.ps1
#>
[CmdletBinding()]
param(
  [string]$WorkCentersList = "CT Work Centers",
  [string]$PeopleList = "CT People",
  [string]$WorkOrdersList = "CT Work Orders",
  [string]$AbsencesList = "CT Time Off"
)

$ErrorActionPreference = "Stop"

function Ensure-List {
  param([string]$Title, [string]$Description)
  $list = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
  if (-not $list) {
    $list = New-PnPList -Title $Title -Template GenericList -OnQuickLaunch
    Write-Host "Created list: $Title"
  } else {
    Write-Host "List already exists: $Title"
  }
  if ($Description) {
    Set-PnPList -Identity $Title -Description $Description
  }
  return $list
}

function Ensure-Field {
  param(
    [string]$List,
    [string]$InternalName,
    [string]$DisplayName,
    [string]$Type,
    [string[]]$Choices,
    [switch]$AddToDefaultView
  )
  $existing = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "  Field exists: $InternalName"
    return
  }
  $params = @{
    List         = $List
    InternalName = $InternalName
    DisplayName  = $DisplayName
    Type         = $Type
  }
  if ($AddToDefaultView) { $params.AddToDefaultView = $true }
  if ($Choices) { $params.Choices = $Choices }
  Add-PnPField @params | Out-Null
  Write-Host "  Added field: $InternalName"
}

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell) -and -not (Get-Module -Name PnP.PowerShell)) {
  throw "PnP.PowerShell is required. Install it with: Install-Module PnP.PowerShell -Scope CurrentUser"
}

Ensure-List -Title $WorkCentersList -Description "Capacity Tracker work centers"
Ensure-Field -List $WorkCentersList -InternalName "Notes" -DisplayName "Notes" -Type Note -AddToDefaultView
Ensure-Field -List $WorkCentersList -InternalName "Color" -DisplayName "Color" -Type Text -AddToDefaultView

Ensure-List -Title $PeopleList -Description "Capacity Tracker employee roster"
Ensure-Field -List $PeopleList -InternalName "WorkCenterId" -DisplayName "Work Center Id" -Type Number -AddToDefaultView
Ensure-Field -List $PeopleList -InternalName "WorkCenterName" -DisplayName "Work Center" -Type Text -AddToDefaultView
Ensure-Field -List $PeopleList -InternalName "HoursPerWeek" -DisplayName "Hours / week" -Type Number -AddToDefaultView
Ensure-Field -List $PeopleList -InternalName "WorkDays" -DisplayName "Work days / week" -Type Number -AddToDefaultView
Ensure-Field -List $PeopleList -InternalName "WorksWeekends" -DisplayName "Works weekends" -Type Boolean -AddToDefaultView
Ensure-Field -List $PeopleList -InternalName "Efficiency" -DisplayName "Efficiency %" -Type Number -AddToDefaultView
Ensure-Field -List $PeopleList -InternalName "Notes" -DisplayName "Notes" -Type Note -AddToDefaultView

Ensure-List -Title $WorkOrdersList -Description "Capacity Tracker work orders"
Ensure-Field -List $WorkOrdersList -InternalName "JobName" -DisplayName "Job name" -Type Text -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "WorkCenterId" -DisplayName "Work Center Id" -Type Number -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "WorkCenterName" -DisplayName "Work Center" -Type Text -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "Hours" -DisplayName "Hours" -Type Number -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "RemainingHours" -DisplayName "Hours remaining" -Type Number -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "DueDate" -DisplayName "Due date" -Type DateTime -AddToDefaultView
$due = Get-PnPField -List $WorkOrdersList -Identity "DueDate" -ErrorAction SilentlyContinue
if ($due) {
  Set-PnPField -List $WorkOrdersList -Identity "DueDate" -Values @{ DisplayFormat = 0 } | Out-Null
}
Ensure-Field -List $WorkOrdersList -InternalName "Status" -DisplayName "Status" -Type Choice -Choices @("queued","in-progress","on-hold","complete") -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "Priority" -DisplayName "Priority" -Type Choice -Choices @("high","medium","low") -AddToDefaultView
Ensure-Field -List $WorkOrdersList -InternalName "Notes" -DisplayName "Notes" -Type Note -AddToDefaultView

Ensure-List -Title $AbsencesList -Description "Capacity Tracker PTO and sick time"
Ensure-Field -List $AbsencesList -InternalName "PersonId" -DisplayName "Person Id" -Type Number -AddToDefaultView
Ensure-Field -List $AbsencesList -InternalName "PersonName" -DisplayName "Employee" -Type Text -AddToDefaultView
Ensure-Field -List $AbsencesList -InternalName "AbsenceType" -DisplayName "Type" -Type Choice -Choices @("pto","sick","other") -AddToDefaultView
Ensure-Field -List $AbsencesList -InternalName "StartDate" -DisplayName "Start" -Type DateTime -AddToDefaultView
Ensure-Field -List $AbsencesList -InternalName "EndDate" -DisplayName "End" -Type DateTime -AddToDefaultView
foreach ($name in @("StartDate", "EndDate")) {
  $field = Get-PnPField -List $AbsencesList -Identity $name -ErrorAction SilentlyContinue
  if ($field) {
    Set-PnPField -List $AbsencesList -Identity $name -Values @{ DisplayFormat = 0 } | Out-Null
  }
}
Ensure-Field -List $AbsencesList -InternalName "Hours" -DisplayName "Hours" -Type Number -AddToDefaultView
Ensure-Field -List $AbsencesList -InternalName "IncludeWeekends" -DisplayName "Include weekends" -Type Boolean -AddToDefaultView
Ensure-Field -List $AbsencesList -InternalName "Notes" -DisplayName "Notes" -Type Note -AddToDefaultView

Write-Host ""
Write-Host "Done. In Capacity Tracker go to Settings, choose SharePoint lists, and test the connection."
