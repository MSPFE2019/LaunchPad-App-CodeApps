[CmdletBinding()]
param(
    [string]$DataverseUrl = $env:DATAVERSE_URL,
    [string]$ClientId = $env:DATAVERSE_CLIENT_ID,
    [string]$ClientSecret = $env:DATAVERSE_CLIENT_SECRET,
    [string]$TenantId = $env:DATAVERSE_TENANT_ID,
    [string]$PublisherUniqueName = "launchpad",
    [string]$SolutionUniqueName = "LaunchPadApp",
    [string]$TableSchemaName = "lppac_LaunchPadApp"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$requiredSettings = [ordered]@{
    DATAVERSE_URL           = $DataverseUrl
    DATAVERSE_CLIENT_ID     = $ClientId
    DATAVERSE_CLIENT_SECRET = $ClientSecret
    DATAVERSE_TENANT_ID     = $TenantId
}

$missingSettings = @($requiredSettings.GetEnumerator() | Where-Object {
        [string]::IsNullOrWhiteSpace([string]$_.Value)
    } | ForEach-Object Key)

if ($missingSettings.Count -gt 0) {
    throw "Missing required settings: $($missingSettings -join ', '). Supply parameters or environment variables."
}

$DataverseUrl = $DataverseUrl.TrimEnd("/")
$apiUrl = "$DataverseUrl/api/data/v9.2"

function New-LocalizedLabel {
    param(
        [Parameter(Mandatory)]
        [string]$Text
    )

    return @{
        "@odata.type" = "Microsoft.Dynamics.CRM.Label"
        LocalizedLabels = @(
            @{
                "@odata.type" = "Microsoft.Dynamics.CRM.LocalizedLabel"
                Label          = $Text
                LanguageCode   = 1033
            }
        )
    }
}

function New-RequiredLevel {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("None", "Recommended", "ApplicationRequired", "SystemRequired")]
        [string]$Value
    )

    return @{
        Value                      = $Value
        CanBeChanged               = $true
        ManagedPropertyLogicalName = "canmodifyrequirementlevelsettings"
    }
}

function Escape-ODataString {
    param(
        [Parameter(Mandatory)]
        [string]$Value
    )

    return $Value.Replace("'", "''")
}

$tokenResponse = Invoke-RestMethod `
    -Method Post `
    -Uri "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
        client_id     = $ClientId
        client_secret = $ClientSecret
        grant_type    = "client_credentials"
        scope         = "$DataverseUrl/.default"
    }

$headers = @{
    Authorization    = "Bearer $($tokenResponse.access_token)"
    Accept           = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version"    = "4.0"
}

function Invoke-DataverseRequest {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("Get", "Post", "Patch")]
        [string]$Method,
        [Parameter(Mandatory)]
        [string]$RelativePath,
        [hashtable]$Body,
        [string]$SolutionName
    )

    $requestHeaders = $headers.Clone()
    if (-not [string]::IsNullOrWhiteSpace($SolutionName)) {
        $requestHeaders["MSCRM.SolutionUniqueName"] = $SolutionName
    }

    $request = @{
        Method      = $Method
        Uri         = "$apiUrl/$RelativePath"
        Headers     = $requestHeaders
        ContentType = "application/json; charset=utf-8"
    }

    if ($null -ne $Body) {
        $request.Body = $Body | ConvertTo-Json -Depth 20
    }

    $response = Invoke-RestMethod @request
    return $response
}

function Get-SingleRecord {
    param(
        [Parameter(Mandatory)]
        [string]$RelativePath,
        [Parameter(Mandatory)]
        [string]$Description
    )

    $response = @(Invoke-DataverseRequest -Method Get -RelativePath $RelativePath)
    if ($response.Count -eq 1 -and $null -ne $response[0].PSObject.Properties["value"]) {
        $records = @($response[0].value)
    }
    else {
        # Windows PowerShell can unwrap OData collection responses into records.
        $records = $response
    }

    if ($records.Count -gt 1) {
        throw "More than one $Description matched. Refine the unique name before continuing."
    }

    if ($records.Count -eq 1) {
        return $records[0]
    }

    return $null
}

$escapedPublisherName = Escape-ODataString $PublisherUniqueName
$publisher = Get-SingleRecord `
    -Description "publisher" `
    -RelativePath "publishers?`$select=publisherid,uniquename,customizationprefix&`$filter=uniquename eq '$escapedPublisherName'"

if ($null -eq $publisher) {
    Write-Host "Creating publisher '$PublisherUniqueName' with prefix 'lppac'."
    $null = Invoke-DataverseRequest -Method Post -RelativePath "publishers" -Body @{
        uniquename                     = $PublisherUniqueName
        friendlyname                   = "LaunchPad"
        description                    = "Publisher for the LaunchPad Power Apps Code App."
        customizationprefix            = "lppac"
        customizationoptionvalueprefix = 72700
    }

    $publisher = Get-SingleRecord `
        -Description "publisher" `
        -RelativePath "publishers?`$select=publisherid,uniquename,customizationprefix&`$filter=uniquename eq '$escapedPublisherName'"
}
elseif ($publisher.customizationprefix -ne "lppac") {
    throw "Publisher '$PublisherUniqueName' exists with prefix '$($publisher.customizationprefix)', not 'lppac'."
}
else {
    Write-Host "Publisher '$PublisherUniqueName' already exists."
}

$escapedSolutionName = Escape-ODataString $SolutionUniqueName
$solution = Get-SingleRecord `
    -Description "solution" `
    -RelativePath "solutions?`$select=solutionid,uniquename,ismanaged,_publisherid_value&`$filter=uniquename eq '$escapedSolutionName'"

if ($null -eq $solution) {
    Write-Host "Creating unmanaged solution '$SolutionUniqueName'."
    $null = Invoke-DataverseRequest -Method Post -RelativePath "solutions" -Body @{
        uniquename                = $SolutionUniqueName
        friendlyname              = "LaunchPad App"
        description               = "Unmanaged solution for the LaunchPad Power Apps Code App and Dataverse schema."
        version                   = "1.0.0.0"
        "publisherid@odata.bind" = "/publishers($($publisher.publisherid))"
    }

    $solution = Get-SingleRecord `
        -Description "solution" `
        -RelativePath "solutions?`$select=solutionid,uniquename,ismanaged,_publisherid_value&`$filter=uniquename eq '$escapedSolutionName'"
}
else {
    if ($solution.ismanaged) {
        throw "Solution '$SolutionUniqueName' already exists as managed. Choose another -SolutionUniqueName."
    }

    if ([string]$solution._publisherid_value -ne [string]$publisher.publisherid) {
        throw "Solution '$SolutionUniqueName' belongs to a different publisher. Choose another -SolutionUniqueName."
    }

    Write-Host "Unmanaged solution '$SolutionUniqueName' already exists."
}

$tableLogicalName = $TableSchemaName.ToLowerInvariant()
$escapedTableLogicalName = Escape-ODataString $tableLogicalName
$table = Get-SingleRecord `
    -Description "table" `
    -RelativePath "EntityDefinitions?`$select=MetadataId,LogicalName,PrimaryNameAttribute&`$filter=LogicalName eq '$escapedTableLogicalName'"

if ($null -eq $table) {
    Write-Host "Creating table '$TableSchemaName'."
    $tableBody = @{
        "@odata.type"         = "Microsoft.Dynamics.CRM.EntityMetadata"
        SchemaName            = $TableSchemaName
        DisplayName           = New-LocalizedLabel "LaunchPad App"
        DisplayCollectionName = New-LocalizedLabel "LaunchPad Apps"
        Description           = New-LocalizedLabel "Applications displayed by the LaunchPad Power Apps Code App."
        OwnershipType         = "OrganizationOwned"
        IsActivity            = $false
        HasActivities         = $false
        HasNotes              = $false
        Attributes            = @(
            @{
                "@odata.type"    = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
                AttributeType    = "String"
                AttributeTypeName = @{ Value = "StringType" }
                SchemaName       = "lppac_Title"
                DisplayName      = New-LocalizedLabel "Title"
                Description      = New-LocalizedLabel "Application title."
                IsPrimaryName    = $true
                RequiredLevel    = New-RequiredLevel "ApplicationRequired"
                MaxLength        = 200
                FormatName       = @{ Value = "Text" }
            }
        )
    }

    $null = Invoke-DataverseRequest `
        -Method Post `
        -RelativePath "EntityDefinitions" `
        -Body $tableBody `
        -SolutionName $SolutionUniqueName

    $table = Get-SingleRecord `
        -Description "table" `
        -RelativePath "EntityDefinitions?`$select=MetadataId,LogicalName,PrimaryNameAttribute&`$filter=LogicalName eq '$escapedTableLogicalName'"
}
elseif ($table.PrimaryNameAttribute -ne "lppac_title") {
    throw "Table '$tableLogicalName' exists with primary column '$($table.PrimaryNameAttribute)', not 'lppac_title'."
}
else {
    Write-Host "Table '$tableLogicalName' already exists."
}

$columns = @(
    @{ SchemaName = "lppac_AppUrl"; DisplayName = "App URL"; Type = "String"; Required = $true; MaxLength = 2000; Description = "URL used to launch the application." }
    @{ SchemaName = "lppac_AppDescription"; DisplayName = "App Description"; Type = "Memo"; Required = $true; MaxLength = 10000; Description = "Description of the application." }
    @{ SchemaName = "lppac_AppOwner"; DisplayName = "App Owner"; Type = "String"; Required = $false; MaxLength = 320; Description = "Owner UPN or email address. Stored as text to avoid environment-specific user lookup dependencies." }
    @{ SchemaName = "lppac_AppStatus"; DisplayName = "App Status"; Type = "Picklist"; Required = $false; Description = "Application lifecycle status." }
    @{ SchemaName = "lppac_Audience"; DisplayName = "Audience"; Type = "String"; Required = $true; MaxLength = 200; Description = "Intended audience, such as Statewide or Agency." }
    @{ SchemaName = "lppac_AgencyFilter"; DisplayName = "Agency Filter"; Type = "String"; Required = $false; MaxLength = 500; Description = "Filter can be Department or Company from Azure AD or Email Domain." }
    @{ SchemaName = "lppac_Office365Group"; DisplayName = "Office 365 Group"; Type = "String"; Required = $false; MaxLength = 320; Description = "Microsoft 365 group UPN or email address. Stored as text to avoid environment-specific lookup dependencies." }
    @{ SchemaName = "lppac_LicenseDesignation"; DisplayName = "License Designation"; Type = "String"; Required = $false; MaxLength = 200; Description = "License designation for the application." }
    @{ SchemaName = "lppac_AppID"; DisplayName = "App ID"; Type = "String"; Required = $false; MaxLength = 200; Description = "Power Apps application identifier." }
    @{ SchemaName = "lppac_AppType"; DisplayName = "App Type"; Type = "String"; Required = $true; MaxLength = 200; Description = "Application type." }
    @{ SchemaName = "lppac_AppVersion"; DisplayName = "App Version"; Type = "String"; Required = $false; MaxLength = 100; Description = "Application version." }
    @{ SchemaName = "lppac_AppUpdate"; DisplayName = "App Update"; Type = "String"; Required = $false; MaxLength = 500; Description = "Application update information." }
    @{ SchemaName = "lppac_Category"; DisplayName = "Category"; Type = "String"; Required = $false; MaxLength = 200; Description = "Application category." }
)

foreach ($column in $columns) {
    $logicalName = $column.SchemaName.ToLowerInvariant()
    $escapedLogicalName = Escape-ODataString $logicalName
    $existingColumn = Get-SingleRecord `
        -Description "column '$logicalName'" `
        -RelativePath "EntityDefinitions(LogicalName='$escapedTableLogicalName')/Attributes?`$select=MetadataId,LogicalName&`$filter=LogicalName eq '$escapedLogicalName'"

    if ($null -ne $existingColumn) {
        Write-Host "Column '$logicalName' already exists."
        continue
    }

    $requiredLevel = if ($column.Required) { "ApplicationRequired" } else { "None" }
    $attributeBody = @{
        SchemaName    = $column.SchemaName
        DisplayName   = New-LocalizedLabel $column.DisplayName
        Description   = New-LocalizedLabel $column.Description
        RequiredLevel = New-RequiredLevel $requiredLevel
    }

    switch ($column.Type) {
        "String" {
            $attributeBody["@odata.type"] = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
            $attributeBody.AttributeType = "String"
            $attributeBody.AttributeTypeName = @{ Value = "StringType" }
            $attributeBody.MaxLength = $column.MaxLength
            $attributeBody.FormatName = @{ Value = "Text" }
        }
        "Memo" {
            $attributeBody["@odata.type"] = "Microsoft.Dynamics.CRM.MemoAttributeMetadata"
            $attributeBody.AttributeType = "Memo"
            $attributeBody.AttributeTypeName = @{ Value = "MemoType" }
            $attributeBody.MaxLength = $column.MaxLength
            $attributeBody.Format = "TextArea"
        }
        "Picklist" {
            $attributeBody["@odata.type"] = "Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
            $attributeBody.AttributeType = "Picklist"
            $attributeBody.AttributeTypeName = @{ Value = "PicklistType" }
            $attributeBody.SourceTypeMask = 0
            $attributeBody.DefaultFormValue = 727000000
            $attributeBody.OptionSet = @{
                "@odata.type" = "Microsoft.Dynamics.CRM.OptionSetMetadata"
                IsGlobal       = $false
                OptionSetType  = "Picklist"
                Options        = @(
                    @{ Value = 727000000; Label = New-LocalizedLabel "Active" }
                    @{ Value = 727000001; Label = New-LocalizedLabel "Maintenance" }
                    @{ Value = 727000002; Label = New-LocalizedLabel "Inactive" }
                    @{ Value = 727000003; Label = New-LocalizedLabel "Retired" }
                )
            }
        }
        default {
            throw "Unsupported Dataverse column type '$($column.Type)'."
        }
    }

    Write-Host "Creating column '$logicalName'."
    $null = Invoke-DataverseRequest `
        -Method Post `
        -RelativePath "EntityDefinitions(LogicalName='$escapedTableLogicalName')/Attributes" `
        -Body $attributeBody `
        -SolutionName $SolutionUniqueName
}

$choiceTableLogicalName = "lppac_launchpadchoice"
$escapedChoiceTableLogicalName = Escape-ODataString $choiceTableLogicalName
$choiceTable = Get-SingleRecord `
    -Description "LaunchPad choice table" `
    -RelativePath "EntityDefinitions?`$select=MetadataId,LogicalName,PrimaryNameAttribute,EntitySetName&`$filter=LogicalName eq '$escapedChoiceTableLogicalName'"

if ($null -eq $choiceTable) {
    Write-Host "Creating table 'lppac_LaunchPadChoice'."
    $null = Invoke-DataverseRequest `
        -Method Post `
        -RelativePath "EntityDefinitions" `
        -SolutionName $SolutionUniqueName `
        -Body @{
            "@odata.type"         = "Microsoft.Dynamics.CRM.EntityMetadata"
            SchemaName            = "lppac_LaunchPadChoice"
            DisplayName           = New-LocalizedLabel "LaunchPad Choice"
            DisplayCollectionName = New-LocalizedLabel "LaunchPad Choices"
            Description           = New-LocalizedLabel "Configurable Audience, Category, and App Type values used by LaunchPad."
            OwnershipType         = "OrganizationOwned"
            IsActivity            = $false
            HasActivities         = $false
            HasNotes              = $false
            Attributes            = @(
                @{
                    "@odata.type"     = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
                    AttributeType     = "String"
                    AttributeTypeName = @{ Value = "StringType" }
                    SchemaName        = "lppac_Value"
                    DisplayName       = New-LocalizedLabel "Value"
                    Description       = New-LocalizedLabel "Value displayed in a LaunchPad dropdown."
                    IsPrimaryName     = $true
                    RequiredLevel     = New-RequiredLevel "ApplicationRequired"
                    MaxLength         = 200
                    FormatName        = @{ Value = "Text" }
                }
            )
        }

    $choiceTable = Get-SingleRecord `
        -Description "LaunchPad choice table" `
        -RelativePath "EntityDefinitions?`$select=MetadataId,LogicalName,PrimaryNameAttribute,EntitySetName&`$filter=LogicalName eq '$escapedChoiceTableLogicalName'"
}
else {
    Write-Host "Table '$choiceTableLogicalName' already exists."
}

$choiceTypeColumn = Get-SingleRecord `
    -Description "column 'lppac_choicetype'" `
    -RelativePath "EntityDefinitions(LogicalName='$escapedChoiceTableLogicalName')/Attributes?`$select=MetadataId,LogicalName&`$filter=LogicalName eq 'lppac_choicetype'"

if ($null -eq $choiceTypeColumn) {
    Write-Host "Creating column 'lppac_choicetype'."
    $null = Invoke-DataverseRequest `
        -Method Post `
        -RelativePath "EntityDefinitions(LogicalName='$escapedChoiceTableLogicalName')/Attributes" `
        -SolutionName $SolutionUniqueName `
        -Body @{
            "@odata.type"     = "Microsoft.Dynamics.CRM.StringAttributeMetadata"
            AttributeType     = "String"
            AttributeTypeName = @{ Value = "StringType" }
            SchemaName        = "lppac_ChoiceType"
            DisplayName       = New-LocalizedLabel "Choice Type"
            Description       = New-LocalizedLabel "Dropdown that uses this value: Audience, Category, or App Type."
            RequiredLevel     = New-RequiredLevel "ApplicationRequired"
            MaxLength         = 50
            FormatName        = @{ Value = "Text" }
        }
}
else {
    Write-Host "Column 'lppac_choicetype' already exists."
}

$defaultChoices = @(
    @{ Type = "Audience"; Value = "Statewide" }
    @{ Type = "Audience"; Value = "Agency" }
    @{ Type = "Category"; Value = "Business" }
    @{ Type = "Category"; Value = "Collaboration" }
    @{ Type = "Category"; Value = "Data and Analytics" }
    @{ Type = "Category"; Value = "Productivity" }
    @{ Type = "App Type"; Value = "Web Application" }
    @{ Type = "App Type"; Value = "Power App" }
    @{ Type = "App Type"; Value = "Mobile Application" }
)

foreach ($choice in $defaultChoices) {
    $escapedChoiceType = Escape-ODataString $choice.Type
    $escapedChoiceValue = Escape-ODataString $choice.Value
    $existingChoice = Get-SingleRecord `
        -Description "choice '$($choice.Type): $($choice.Value)'" `
        -RelativePath "lppac_launchpadchoices?`$select=lppac_launchpadchoiceid&`$filter=lppac_choicetype eq '$escapedChoiceType' and lppac_value eq '$escapedChoiceValue'"

    if ($null -eq $existingChoice) {
        Write-Host "Creating choice '$($choice.Type): $($choice.Value)'."
        $null = Invoke-DataverseRequest `
            -Method Post `
            -RelativePath "lppac_launchpadchoices" `
            -Body @{
                lppac_choicetype = $choice.Type
                lppac_value      = $choice.Value
            }
    }
    else {
        Write-Host "Choice '$($choice.Type): $($choice.Value)' already exists."
    }
}

Write-Host "Provisioning complete for unmanaged solution '$SolutionUniqueName' in '$DataverseUrl'."
