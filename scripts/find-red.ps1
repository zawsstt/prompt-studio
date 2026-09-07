param(
  [Parameter(Mandatory = $true)][string]$ImagePath,
  [Parameter(Mandatory = $true)][string]$OutDir
)
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($ImagePath)
$w = $bmp.Width; $h = $bmp.Height
Write-Host "size: ${w}x${h}"

$minX = $w; $minY = $h; $maxX = 0; $maxY = 0; $count = 0
$step = 2
for ($y = 0; $y -lt $h; $y += $step) {
  for ($x = 0; $x -lt $w; $x += $step) {
    $p = $bmp.GetPixel($x, $y)
    if ($p.R -gt 150 -and ($p.R - $p.G) -gt 60 -and ($p.R - $p.B) -gt 60) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
      $count++
    }
  }
}
Write-Host "red samples: $count"
if ($count -eq 0) { Write-Host "NO RED PIXELS"; $bmp.Dispose(); exit 0 }
Write-Host "red bbox: x[$minX-$maxX] y[$minY-$maxY]"

$pad = 40
$cx = [Math]::Max(0, $minX - $pad)
$cy = [Math]::Max(0, $minY - $pad)
$cw = [Math]::Min($w - $cx, ($maxX - $minX) + $pad * 2)
$ch = [Math]::Min($h - $cy, ($maxY - $minY) + $pad * 2)
$scale = 3
$crop = New-Object System.Drawing.Bitmap($cw * $scale, $ch * $scale)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$srcRect = New-Object System.Drawing.Rectangle($cx, $cy, $cw, $ch)
$dstRect = New-Object System.Drawing.Rectangle(0, 0, $cw * $scale, $ch * $scale)
$g.DrawImage($bmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$outFile = Join-Path $OutDir ("red-" + (Split-Path $ImagePath -Leaf))
$crop.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $crop.Dispose(); $bmp.Dispose()
Write-Host "saved: $outFile"
