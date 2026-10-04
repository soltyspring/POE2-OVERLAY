param([string]$ImagePath, [switch]$Worker)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$asyncMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-Result($Operation, $Type) {
    $task = $asyncMethod.MakeGenericMethod($Type).Invoke($null, @($Operation))
    $task.GetAwaiter().GetResult()
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ko-KR'))
if ($null -eq $engine) { throw '한국어 Windows OCR이 없습니다. Windows 언어 설정에서 한국어 OCR 기능을 설치하세요.' }
function Read-Ocr([string]$ImagePath) {
$file = Await-Result ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
$stream = Await-Result ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
try {
    $decoder = Await-Result ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
        $result = Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $lines = @(foreach ($line in $result.Lines) {
            $left = [double]::PositiveInfinity; $top = [double]::PositiveInfinity
            $right = 0.0; $bottom = 0.0
            foreach ($word in $line.Words) {
                $bounds = $word.BoundingRect
                $left = [Math]::Min($left, $bounds.X)
                $top = [Math]::Min($top, $bounds.Y)
                $right = [Math]::Max($right, $bounds.X + $bounds.Width)
                $bottom = [Math]::Max($bottom, $bounds.Y + $bounds.Height)
            }
            if ([double]::IsInfinity($left)) { continue }
            [pscustomobject]@{ text = $line.Text; x = $left; y = $top; width = $right-$left; height = $bottom-$top }
        })
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
        return ,$lines
    } finally { $bitmap.Dispose() }
} finally { $stream.Dispose() }
}
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
if ($Worker) {
  while ($null -ne ($request = [Console]::ReadLine())) {
    try {
      $path = ($request | ConvertFrom-Json).path
      $process = [System.Diagnostics.Process]::GetCurrentProcess()
      $cpuBefore = $process.TotalProcessorTime.TotalMilliseconds
      $watch = [System.Diagnostics.Stopwatch]::StartNew()
      $lines = Read-Ocr $path
      $watch.Stop(); $process.Refresh()
      $response = @{ lines=@($lines); metrics=@{engine='Windows Korean OCR';ocrMs=$watch.ElapsedMilliseconds;cpuMs=[Math]::Round($process.TotalProcessorTime.TotalMilliseconds-$cpuBefore);rssMB=[Math]::Round($process.WorkingSet64/1MB,1)} }
    } catch { $response = @{error=$_.Exception.Message} }
    [Console]::WriteLine((ConvertTo-Json -InputObject $response -Depth 8 -Compress))
  }
} else { ConvertTo-Json -InputObject @(Read-Ocr $ImagePath) -Depth 5 -Compress }
