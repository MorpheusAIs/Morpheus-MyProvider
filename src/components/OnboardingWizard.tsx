'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, ExternalLink, Rocket } from 'lucide-react';
import SecretVmOnboarding from '@/components/SecretVmOnboarding';
import SecretVmStoryboard from '@/components/SecretVmStoryboard';
import ExistingProviderGate from '@/components/ExistingProviderGate';
import { EXTERNAL_LINKS } from '@/lib/constants';
import { DEPLOY_PATHS, getDeployPath, type DeployPath } from '@/lib/deployPaths';

interface OnboardingWizardProps {
  deployPath: DeployPath;
  onDeployPathChange: (path: DeployPath) => void;
  onOpenBootstrap: () => void;
  onEnteredOperator?: () => void;
  /** When true, show SecretVM bootstrap instead of existing-provider connect. */
  showNewBootstrap: boolean;
  onShowNewBootstrapChange: (show: boolean) => void;
}

/**
 * Landing: existing operators connect first; new providers opt into SecretVM bootstrap.
 */
export default function OnboardingWizard({
  deployPath,
  onDeployPathChange,
  onOpenBootstrap,
  onEnteredOperator,
  showNewBootstrap,
  onShowNewBootstrapChange,
}: OnboardingWizardProps) {
  const pathMeta = getDeployPath(deployPath);

  if (!showNewBootstrap) {
    return (
      <ExistingProviderGate
        onConnected={() => onEnteredOperator?.()}
        onStartBootstrap={() => {
          onDeployPathChange('secretvm');
          onShowNewBootstrapChange(true);
        }}
      />
    );
  }

  return (
    <Card className="border-primary/30 bg-zinc-900/95 shadow-lg">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Rocket className="h-5 w-5 text-primary" />
            Bootstrap a new provider
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => onShowNewBootstrapChange(false)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to connect
          </Button>
        </div>
        <CardDescription>
          Start with <strong>SecretVM</strong> (easiest HTTPS path for MyProvider). Bootstrap the
          node, set the hostname after the VM starts, connect and register, then add models and
          bids. Prefer existing model Ids from{' '}
          <a
            href={EXTERNAL_LINKS.activeStatus}
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            active.mor.org
          </a>
          .
        </CardDescription>
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <p>
            <strong className="text-amber-300">Session only.</strong> Keys stay in this browser tab
            (or a file you save locally) — nothing is uploaded to myprovider.mor.org.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEPLOY_PATHS.map((p) => {
            const Icon = p.icon;
            const active = deployPath === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-lg border p-4 transition ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onDeployPathChange(p.id)}
                  className="w-full text-left"
                >
                  <Icon className="h-5 w-5 mb-2 text-primary" />
                  <div className="font-semibold text-sm">{p.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.blurb}</div>
                </button>
                {p.id === 'secretvm' && (
                  <div className="mt-1">
                    <SecretVmStoryboard variant="cta" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {deployPath === 'secretvm' ? (
          <SecretVmOnboarding
            onOpenBootstrap={onOpenBootstrap}
            onEnteredOperator={onEnteredOperator}
          />
        ) : (
          <div className="rounded-lg border border-zinc-700 bg-zinc-950/50 p-4 space-y-3 text-sm">
            <p className="font-medium text-foreground">{pathMeta.title}</p>
            <p className="text-muted-foreground text-xs">
              We&apos;re tuning the <strong className="text-foreground">SecretVM</strong> path first
              (node up → hostname → connect/register → models/bids). Container / Release / GitHub
              will follow the same order once SecretVM feels right. Use the advanced ENV helper or
              path docs for now.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onOpenBootstrap}>
                Advanced ENV helper
              </Button>
              <a
                href={pathMeta.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline px-2"
              >
                {pathMeta.title} docs <ExternalLink className="h-3 w-3" />
              </a>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onDeployPathChange('secretvm')}
              >
                Switch to SecretVM flow
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
