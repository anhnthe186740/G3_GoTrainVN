if (Test-Path 'temp_xlsx') { Remove-Item 'temp_xlsx' -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path 'temp_tracking.zip') { Remove-Item 'temp_tracking.zip' -Force -ErrorAction SilentlyContinue }
Copy-Item 'G3_Project Tracking.xlsx' 'temp_tracking.zip' -Force
Expand-Archive -Force -Path 'temp_tracking.zip' -DestinationPath 'temp_xlsx'
$xmlPath = 'temp_xlsx/xl/sharedStrings.xml'
if (Test-Path $xmlPath) {
    $content = Get-Content -Path $xmlPath -Raw -Encoding utf8
    [xml]$xml = $content
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    # In sharedStrings, the text is inside <si><t>Text</t></si>
    $texts = $xml.SelectNodes("//x:t", $ns)
    $output = foreach ($t in $texts) { $t.InnerText }
    $output | Out-File -FilePath 'extracted_xlsx_text.txt' -Encoding utf8
    Write-Host "Success"
} else {
    Write-Host "sharedStrings.xml not found"
}
