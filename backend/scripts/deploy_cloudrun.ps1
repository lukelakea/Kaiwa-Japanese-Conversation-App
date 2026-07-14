# Deploy the Kaiwa backend to Google Cloud Run (hosted cloud demo).
#
# One-time setup in the GCP project (see README "Deploying a live demo"):
#   1. Enable APIs: Cloud Run, Cloud Build, Secret Manager, Text-to-Speech,
#      Speech-to-Text.
#   2. Create the secrets (paste the key value when prompted):
#        gcloud secrets create kaiwa-anthropic-api-key --data-file=-
#        gcloud secrets create kaiwa-google-cloud-api-key --data-file=-
#      and grant the Cloud Run runtime service account "Secret Manager Secret
#      Accessor" on both.
#
# Then deploy (from anywhere):
#   .\backend\scripts\deploy_cloudrun.ps1 -ProjectId my-project `
#       -CorsOrigin https://kaiwa.vercel.app
#
# Re-run the same command to deploy updates; Cloud Build rebuilds the
# Dockerfile (dictionary included) and Cloud Run swaps revisions with no
# downtime.

param(
    [Parameter(Mandatory = $true)] [string]$ProjectId,
    [Parameter(Mandatory = $true)] [string]$CorsOrigin,
    [string]$Region = 'us-west1',
    [string]$ServiceName = 'kaiwa-api',
    [string]$RateLimit = '30/minute,500/hour'
)

$backendDir = Resolve-Path (Join-Path $PSScriptRoot '..')

# min-instances 0 scales to zero when idle (free tier; first request after idle
# takes a few seconds). max-instances 2 caps the blast radius of a traffic spike
# alongside the app's own per-IP rate limit.
gcloud run deploy $ServiceName `
    --project $ProjectId `
    --region $Region `
    --source $backendDir `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 2 `
    --set-env-vars "KAIWA_LLM_PROVIDER=anthropic,KAIWA_TTS_PROVIDER=google,KAIWA_STT_PROVIDER=google,KAIWA_RATE_LIMIT=$RateLimit,KAIWA_CORS_ORIGINS=$CorsOrigin" `
    --set-secrets 'KAIWA_ANTHROPIC_API_KEY=kaiwa-anthropic-api-key:latest,KAIWA_GOOGLE_CLOUD_API_KEY=kaiwa-google-cloud-api-key:latest'
