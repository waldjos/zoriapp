param(
  [Parameter(Mandatory = $true)]
  [string]$InputPng,

  [Parameter(Mandatory = $true)]
  [string]$OutputDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Add-Type -AssemblyName System.Drawing

function Save-Resize {
  param(
    [Parameter(Mandatory = $true)][string]$In,
    [Parameter(Mandatory = $true)][string]$Out,
    [Parameter(Mandatory = $true)][int]$Size
  )

  $img = [System.Drawing.Image]::FromFile($In)
  try {
    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)

        # Center-crop to square, then scale.
        $min = [Math]::Min($img.Width, $img.Height)
        $sx = [int](($img.Width - $min) / 2)
        $sy = [int](($img.Height - $min) / 2)

        $dest = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
        $src = New-Object System.Drawing.Rectangle($sx, $sy, $min, $min)

        $g.DrawImage($img, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
        $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $g.Dispose()
      }
    } finally {
      $bmp.Dispose()
    }
  } finally {
    $img.Dispose()
  }
}

$inFile = (Resolve-Path $InputPng).Path
$outDir = (Resolve-Path $OutputDir).Path

Save-Resize -In $inFile -Out (Join-Path $outDir "icon-192.png") -Size 192
Save-Resize -In $inFile -Out (Join-Path $outDir "icon-512.png") -Size 512
Save-Resize -In $inFile -Out (Join-Path $outDir "apple-touch-icon.png") -Size 180

# Rounded/maskable placeholders: same bitmap, different filenames.
Copy-Item -Force (Join-Path $outDir "icon-192.png") (Join-Path $outDir "icon-192-rounded.png")
Copy-Item -Force (Join-Path $outDir "icon-512.png") (Join-Path $outDir "icon-512-rounded.png")
Copy-Item -Force (Join-Path $outDir "icon-512.png") (Join-Path $outDir "maskable-icon-512.png")

Write-Output "OK: icons generated in $outDir"
