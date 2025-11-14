# Deployment Documentation

This document describes the deployment architecture and process for the Morpheus MyProvider dashboard.

## Architecture Overview

### Infrastructure Components

The infrastructure is managed via Terraform/Terragrunt in the `Morpheus-Infra` repository under `environments/06-myprovider/04-prd/`.

**Components:**
1. **S3 Bucket** (us-east-2): Hosts the static Next.js application
   - Bucket name: `prd-myprovider-website`
   - Versioning enabled (keeps last 14 versions)
   - Public read access for website hosting

2. **CloudFront Distribution** (us-east-1): CDN with global edge locations
   - Custom domain: `myprovider.mor.org`
   - TLS certificate via ACM
   - WAF protection enabled
   - Price class: North America and Europe only
   - TTL: 5 minutes default, 1 hour max
   - SPA routing: 404/403 errors redirect to `index.html`

3. **Route53**: DNS alias record pointing to CloudFront

4. **IAM User**: GitHub Actions deployment user
   - User name: `github-actions-myprovider-deploy-prd`
   - Policy grants minimal permissions:
     - S3: List bucket, put/get/delete objects
     - CloudFront: Create/get invalidations
   - Access keys stored in AWS Secrets Manager

## Deployment Process

### Prerequisites

1. **Terraform/Terragrunt Apply**
   - Run `terragrunt plan` and `terragrunt apply` in `Morpheus-Infra/environments/06-myprovider/04-prd/`
   - This creates all AWS resources
   - Retrieve outputs: S3 bucket name, CloudFront distribution ID, AWS access keys

2. **GitHub Secrets Configuration**
   - Navigate to repository Settings → Secrets and variables → Actions
   - Add the following repository secrets:

   | Secret Name | Description | Example Value |
   |-------------|-------------|---------------|
   | `AWS_ACCESS_KEY_ID` | IAM user access key ID | `AKIA...` |
   | `AWS_SECRET_ACCESS_KEY` | IAM user secret access key | Retrieved from AWS Secrets Manager |
   | `AWS_REGION` | AWS region for S3 bucket | `us-east-2` |
   | `S3_BUCKET_NAME` | S3 bucket name | `prd-myprovider-website` |
   | `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID | `E1234567890ABC` |
   | `WEBSITE_DOMAIN` | Website domain (optional, for logging) | `myprovider.mor.org` |

### GitHub Actions Workflow

The deployment workflow (`.github/workflows/deploy.yml`) automatically triggers on every push to the `main` branch.

**Workflow Steps:**
1. Checkout code
2. Setup Node.js v20
3. Install dependencies (`npm ci`)
4. Build Next.js application (`npm run build`)
5. Configure AWS credentials using GitHub secrets
6. Sync `./out/` directory to S3 bucket (with `--delete` flag to remove old files)
7. Create CloudFront invalidation to clear CDN cache
8. Report deployment success

**Build Output:**
- Next.js static export generates files in `./out/` directory
- All files are synced to S3 root with 5-minute cache control
- CloudFront cache is invalidated for all paths (`/*`)

## Manual Deployment

If needed, you can manually deploy from your local machine:

```bash
# Build the application
npm run build

# Configure AWS credentials (if not already set)
export AWS_PROFILE=mor-org-prd
# or
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-2

# Sync to S3
aws s3 sync ./out/ s3://prd-myprovider-website/ \
  --delete \
  --cache-control "public, max-age=300"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Accessing the Website

Once deployed, the website is accessible at:
- **Production URL**: https://myprovider.mor.org

## Troubleshooting

### CloudFront Caching Issues
- CloudFront caches responses for up to 1 hour
- After deployment, invalidation is automatic
- To manually clear cache: Create a CloudFront invalidation for `/*`

### S3 Permissions Issues
- Ensure IAM user has correct permissions
- Verify bucket policy allows public read access
- Check that the bucket is in `us-east-2` region

### Build Failures
- Ensure Node.js version is 20 or higher
- Run `npm ci` to ensure clean dependency installation
- Check build logs in GitHub Actions for specific errors

### Route53/DNS Issues
- Verify Route53 alias record points to CloudFront distribution
- Allow up to 24 hours for DNS propagation (usually much faster)
- Use `dig` or `nslookup` to verify DNS resolution

## Security Considerations

1. **WAF Protection**: CloudFront distribution is protected by AWS WAF
2. **TLS/SSL**: All traffic forced to HTTPS with TLS 1.2+ minimum
3. **IAM Principle of Least Privilege**: GitHub Actions user has minimal required permissions
4. **Secrets Management**: AWS credentials stored securely in GitHub Secrets
5. **Access Keys Rotation**: Rotate IAM access keys periodically (every 90 days recommended)

## Monitoring and Maintenance

### CloudWatch Metrics
Monitor CloudFront and S3 metrics in AWS CloudWatch:
- Request count
- Error rates (4xx, 5xx)
- Data transfer
- Cache hit ratio

### S3 Versioning
- S3 bucket keeps last 14 versions of all objects
- Allows rollback to previous deployment if needed
- Older versions automatically deleted after 14 newer versions exist

### Cost Optimization
- CloudFront price class limited to North America and Europe
- S3 versioning limited to 14 versions to control storage costs
- CDN caching reduces S3 request costs

## Rollback Procedure

If a deployment introduces issues:

1. **Via S3 Versioning:**
   ```bash
   # List object versions
   aws s3api list-object-versions --bucket prd-myprovider-website --prefix index.html
   
   # Restore a specific version (copy version ID to current)
   aws s3api copy-object \
     --bucket prd-myprovider-website \
     --copy-source prd-myprovider-website/index.html?versionId=VERSION_ID \
     --key index.html
   ```

2. **Via Git Revert:**
   ```bash
   # Revert the problematic commit
   git revert <commit-hash>
   git push origin main
   # This triggers a new deployment with the previous code
   ```

3. **Invalidate CloudFront Cache:**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id DISTRIBUTION_ID \
     --paths "/*"
   ```

