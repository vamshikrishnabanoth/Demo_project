$logFile = Join-Path $PSScriptRoot 'resource_usage_log.csv'
'Timestamp,Node_CPU_Pct,Node_Memory_MB,Python_CPU_Pct,Python_Memory_MB,System_CPU_Pct,Available_Memory_GB' | Out-File -FilePath $logFile -Encoding utf8

Write-Host ('📊 Resource Monitor started. Logging to ' + $logFile + ' every 5 seconds...')

while ($true) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    
    # Node process info
    $nodeProcess = Get-Process -Name 'node' -ErrorAction SilentlyContinue | Sort-Object -Property CPU -Descending | Select-Object -First 1
    $nodeCpu = 0
    $nodeMem = 0
    if ($nodeProcess) {
        $nodeMem = [math]::round($nodeProcess.WorkingSet64 / 1MB, 2)
        $wmiNode = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "Name = 'node'" -ErrorAction SilentlyContinue | Sort-Object -Property PercentProcessorTime -Descending | Select-Object -First 1
        if ($wmiNode) {
            $nodeCpu = $wmiNode.PercentProcessorTime
        }
    }
    
    # Python process info
    $pythonProcess = Get-Process -Name 'python' -ErrorAction SilentlyContinue | Sort-Object -Property CPU -Descending | Select-Object -First 1
    $pythonCpu = 0
    $pythonMem = 0
    if ($pythonProcess) {
        $pythonMem = [math]::round($pythonProcess.WorkingSet64 / 1MB, 2)
        $wmiPython = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "Name = 'python'" -ErrorAction SilentlyContinue | Sort-Object -Property PercentProcessorTime -Descending | Select-Object -First 1
        if ($wmiPython) {
            $pythonCpu = $wmiPython.PercentProcessorTime
        }
    }
    
    # System info
    $systemCpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $systemMem = Get-CimInstance Win32_OperatingSystem
    $availMemGB = [math]::round($systemMem.FreePhysicalMemory / 1024 / 1024, 2)
    
    # Output to console
    Write-Host ($timestamp + ' | Node: ' + $nodeCpu + '% CPU, ' + $nodeMem + ' MB RAM | Python: ' + $pythonCpu + '% CPU, ' + $pythonMem + ' MB RAM | Sys: ' + $systemCpu + '% CPU, ' + $availMemGB + ' GB Avail RAM')
    
    # Log to CSV
    ($timestamp + ',' + $nodeCpu + ',' + $nodeMem + ',' + $pythonCpu + ',' + $pythonMem + ',' + $systemCpu + ',' + $availMemGB) | Out-File -FilePath $logFile -Append -Encoding utf8
    
    Start-Sleep -Seconds 5
}
