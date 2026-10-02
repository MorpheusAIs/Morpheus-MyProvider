import type { LucideIcon } from 'lucide-react';
import { Box, Download, GitBranch, Shield } from 'lucide-react';

/** How the operator will run the proxy-router — not which backend LLM they use. */
export type DeployPath = 'secretvm' | 'container' | 'release' | 'github';

export interface DeployPathMeta {
  id: DeployPath;
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Bootstrap / setup-instructions tab id */
  bootstrapTab: 'secretvm' | 'docker' | 'binary' | 'github';
  docsUrl: string;
}

export const DEPLOY_PATHS: DeployPathMeta[] = [
  {
    id: 'secretvm',
    title: 'SecretVM',
    blurb: 'Confidential VM (optional TEE image) with HTTPS — ideal for MyProvider',
    icon: Shield,
    bootstrapTab: 'secretvm',
    docsUrl: 'https://nodedocs.mor.org/providers/full/secretvm-quickstart',
  },
  {
    id: 'container',
    title: 'Container',
    blurb: 'Docker / Compose with the published ghcr.io proxy-router image',
    icon: Box,
    bootstrapTab: 'docker',
    docsUrl: 'https://nodedocs.mor.org/providers/full/proxy-router-docker',
  },
  {
    id: 'release',
    title: 'Release binary',
    blurb: 'Download a platform binary from GitHub Releases and run it locally',
    icon: Download,
    bootstrapTab: 'binary',
    docsUrl: 'https://nodedocs.mor.org/providers/full/quickstart',
  },
  {
    id: 'github',
    title: 'GitHub / source',
    blurb: 'Clone Morpheus-Lumerin-Node and build the proxy-router from source',
    icon: GitBranch,
    bootstrapTab: 'github',
    docsUrl: 'https://github.com/MorpheusAIs/Morpheus-Lumerin-Node',
  },
];

export function getDeployPath(id: DeployPath): DeployPathMeta {
  return DEPLOY_PATHS.find((p) => p.id === id) || DEPLOY_PATHS[0];
}
