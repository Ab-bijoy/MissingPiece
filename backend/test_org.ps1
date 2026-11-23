$tok = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2MyZDEwZC01YzMxLTRhODMtODM3NS1mNzg2MWU2MzI0YjgiLCJlbWFpbCI6InRlc3Qub3JnYW5pemVyQGV4YW1wbGUuY29tIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImlzcyI6Im1pc3NpbmdwaWVjZS1kZXYiLCJpYXQiOjE3OTU0Mjk1NjEsImV4cCI6MTc5NTQ2NTU2MX0.GCnXKx3ECIiKvwWEpKyMhB9FVOXRgHfyehA0YC9kOsU"
$projId = "e3fc87ed-ba84-49d4-b925-2aa3a0878098"
$base = "http://127.0.0.1:8000"
$h = @{ Authorization = "Bearer $tok" }
$hJson = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }

Write-Host "`n1. GET /templates" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/templates" -Headers $h

Write-Host "`n2. GET /projects/{id}" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$base/projects/$projId" -Headers $h

Write-Host "`n3. PATCH /projects/{id}" -ForegroundColor Cyan
$patchProj = @{
  venue = "BUP Auditorium Updated"
  audience = 300
} | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$base/projects/$projId" -Headers $hJson -Body $patchProj

Write-Host "`n4. POST /projects/{id}/needs" -ForegroundColor Cyan
$newNeedBody = @{
  type = "money"
  title = "Stage & Sound"
  quantity = 15000
  unit = "BDT"
  budget_item = "Audio setup"
} | ConvertTo-Json
$createdNeed = Invoke-RestMethod -Method Post -Uri "$base/projects/$projId/needs" -Headers $hJson -Body $newNeedBody
$createdNeed
$needId = $createdNeed.id

Write-Host "`n5. PATCH /needs/{need_id}" -ForegroundColor Cyan
$patchNeedBody = @{
  quantity = 18000
  title = "Stage & Sound System"
} | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$base/needs/$needId" -Headers $hJson -Body $patchNeedBody

Write-Host "`n6. DELETE /needs/{need_id}" -ForegroundColor Cyan
Invoke-RestMethod -Method Delete -Uri "$base/needs/$needId" -Headers $h

Write-Host "`n7. POST /projects/{id}/complete" -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "$base/projects/$projId/complete" -Headers $h