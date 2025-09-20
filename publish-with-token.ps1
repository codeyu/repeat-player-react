# PowerShell script - Publish RepeatPlayer component to npm using Access Token
param(
    [string]$Token = ""
)

Write-Host "🚀 Publishing RepeatPlayer component to npm using Access Token..." -ForegroundColor Green

# Function to read .env file
function Read-EnvFile {
    param([string]$FilePath)
    
    if (-not (Test-Path $FilePath)) {
        return @{}
    }
    
    $envVars = @{}
    Get-Content $FilePath | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
                $value = $matches[1]
            }
            $envVars[$key] = $value
        }
    }
    return $envVars
}

# Try to read token from .env file if no token provided
if (-not $Token) {
    Write-Host "🔍 Looking for .env file..." -ForegroundColor Cyan
    $envVars = Read-EnvFile ".env"
    
    if ($envVars.ContainsKey("NPM_ACCESS_TOKEN")) {
        $Token = $envVars["NPM_ACCESS_TOKEN"]
        Write-Host "✅ Found NPM_ACCESS_TOKEN in .env file" -ForegroundColor Green
    }
}

# Check if NPM_TOKEN environment variable is set or token from .env
if (-not $Token -and -not $env:NPM_TOKEN) {
    Write-Host "❌ Error: NPM_ACCESS_TOKEN not found in any of the following sources:" -ForegroundColor Red
    Write-Host "1. Command line parameter (-Token)" -ForegroundColor Red
    Write-Host "2. Environment variable (NPM_TOKEN)" -ForegroundColor Red
    Write-Host "3. .env file (NPM_ACCESS_TOKEN=your_token_here)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please use one of the following methods:"
    Write-Host "1. Set environment variable: `$env:NPM_TOKEN = 'your_access_token_here'"
    Write-Host "2. Pass parameter: .\publish-with-token.ps1 -Token 'your_access_token_here'"
    Write-Host "3. Create .env file with: NPM_ACCESS_TOKEN=your_access_token_here"
    Write-Host ""
    Read-Host "Press any key to exit"
    exit 1
}

# If token is passed via parameter or from .env file
if ($Token) {
    $env:NPM_TOKEN = $Token
}

Write-Host "📦 Publishing using token..." -ForegroundColor Yellow

# Install dependencies
Write-Host "📥 Installing dependencies..." -ForegroundColor Yellow
pnpm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Dependency installation failed!" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

# Build component library
Write-Host "🔨 Building component library..." -ForegroundColor Yellow
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

# Check build results
if (-not (Test-Path "dist")) {
    Write-Host "❌ Build failed! dist directory not found" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host "✅ Build successful!" -ForegroundColor Green

# Publish to npm
Write-Host "🚀 Publishing to npm..." -ForegroundColor Yellow
npm publish --access public

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉 Publish successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📦 Package info:"
    npm view repeat-player-react
} else {
    Write-Host "❌ Publish failed!" -ForegroundColor Red
}


Read-Host "Press any key to exit"