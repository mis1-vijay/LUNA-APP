$defaultRoute = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
  Sort-Object RouteMetric, InterfaceMetric |
  Select-Object -First 1

$apiAddress = if ($defaultRoute) {
  Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
}

if (-not $apiAddress) {
  throw 'Could not determine this computer''s active LAN IPv4 address.'
}

$ApiBaseUrl = "http://${apiAddress}:8000"
$env:EXPO_PUBLIC_API_BASE_URL = $ApiBaseUrl

$ports = @(8000, 19006)

Write-Host "Using API base URL: $ApiBaseUrl"
Write-Host "Closing stale Luna processes on ports: $($ports -join ', ')"

$connections = Get-NetTCPConnection -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in $ports -and $_.State -eq 'Listen' }

if ($connections) {
  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host "Stopped process $processId"
    } catch {
      Write-Host "Could not stop process $processId"
    }
  }
} else {
  Write-Host "No listener found on the Luna ports."
}

Start-Sleep -Seconds 2

Write-Host "Starting backend on port 8000"
Start-Process PowerShell -ArgumentList '-NoExit','-Command',"cd 'D:\LUNA-APP\LUNA-API'; `$env:EXPO_PUBLIC_API_BASE_URL = '$ApiBaseUrl'; py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

Write-Host "Starting Expo on port 19006"
Start-Process PowerShell -ArgumentList '-NoExit','-Command',"cd 'D:\LUNA-APP\LUNA-HOME'; `$env:EXPO_PUBLIC_API_BASE_URL = '$ApiBaseUrl'; npx expo start --clear --port 19006"

Write-Host "Luna app startup launched."
