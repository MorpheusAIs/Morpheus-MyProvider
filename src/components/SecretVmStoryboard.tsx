'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { HelpCircle, MousePointerClick, RefreshCw } from 'lucide-react';

const STEPS = [
  {
    id: 'boot',
    title: '1 · Bootstrap secrets',
    why: 'Only three real values: wallet key, Base HTTPS RPC, admin password. WEB_PUBLIC_URL and MODELS_CONFIG stay placeholders. Fund the wallet with MOR + ETH on Base.',
    src: '/images/storyboard/01-fund.png',
  },
  {
    id: 'start',
    title: '2 · Start VM (no DNS yet)',
    why: 'Paste digest-pinned compose + bootstrap secrets. SecretVM assigns the public hostname only after the machine exists — you cannot know jade-chipmunk… until it starts.',
    src: '/images/storyboard/02-start.png',
  },
  {
    id: 'dns',
    title: '3 · Hostname → re-paste (restart 1)',
    why: 'Copy the portal URL into MyProvider, copy the 5-line secrets (now with real WEB_PUBLIC_URL), update the VM, restart. That is the first intentional loop.',
    loop: 'Restart 1',
    src: '/images/storyboard/03-dns.png',
  },
  {
    id: 'connect',
    title: '4 · Connect & register',
    why: 'Probe https://<vm>/ with admin credentials. When healthy, register the provider (stake ≥ 0.2 MOR). Models can still be empty.',
    src: '/images/storyboard/04-connect.png',
  },
  {
    id: 'models',
    title: '5 · Models → re-paste → bid (restart 2)',
    why: 'Add backends, update MODELS_CONFIG_CONTENT (last line), re-paste secrets, restart once more, then place on-chain bids (~0.3 MOR each).',
    loop: 'Restart 2',
    src: '/images/storyboard/05-models.png',
  },
] as const;

interface SecretVmStoryboardProps {
  variant?: 'cta' | 'banner';
}

/**
 * SecretVM explainer: five cropped panel images (1:1 with hit targets) + one paragraph.
 * No image-map math — each stage is its own button wrapping its own art.
 */
export default function SecretVmStoryboard({ variant = 'cta' }: SecretVmStoryboardProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hasClicked, setHasClicked] = useState(false);
  const step = STEPS[active];

  const select = (i: number) => {
    setActive(i);
    setHasClicked(true);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setActive(0);
      setHasClicked(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {variant === 'cta' ? (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400/90 hover:text-emerald-300 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <HelpCircle className="h-3 w-3" />
            Why two restarts?
          </button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
          >
            <HelpCircle className="h-3.5 w-3.5 mr-1" />
            Storyboard
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="flex flex-col !max-w-2xl w-[min(92vw,42rem)] max-h-[88vh] overflow-y-auto border-emerald-500/20 bg-[#030712] !p-0 gap-0 sm:rounded-xl">
        <DialogHeader className="relative px-4 sm:px-5 pt-4 pb-2 space-y-1 shrink-0">
          <DialogTitle className="text-base sm:text-lg text-white tracking-tight pr-8">
            Why SecretVM takes two restarts
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 text-emerald-300/90">
              <MousePointerClick className="h-3.5 w-3.5" />
              Click a stage
            </span>
            <span className="text-zinc-600">·</span>
            <span>Bootstrap → hostname → connect → models. Don&apos;t invent the URL early.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-3 sm:px-4 shrink-0">
          <div className="flex items-stretch justify-center gap-1.5 sm:gap-2">
            {STEPS.map((s, i) => {
              const isActive = active === i;
              const showShimmer = i === 0 && !hasClicked;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.title}
                  aria-pressed={isActive}
                  onClick={() => select(i)}
                  className={`relative min-w-0 flex-1 basis-0 rounded-md overflow-hidden outline-none transition-[box-shadow,ring] focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                    isActive
                      ? 'ring-2 ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]'
                      : 'ring-1 ring-white/10 hover:ring-emerald-400/40'
                  } ${showShimmer ? 'storyboard-shimmer-panel' : ''}`}
                >
                  <img
                    src={s.src}
                    alt=""
                    width={240}
                    height={540}
                    className="block w-full h-auto select-none pointer-events-none"
                    draggable={false}
                  />
                  {showShimmer && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-semibold text-black shadow-lg animate-pulse pointer-events-none z-10">
                      Start here
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 space-y-3 shrink-0">
          <div className="rounded-xl border border-white/5 bg-zinc-950/90 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-white">{step.title}</p>
              {'loop' in step && step.loop && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 border border-amber-500/30 rounded-full px-2 py-0.5">
                  <RefreshCw className="h-2.5 w-2.5" />
                  {step.loop}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{step.why}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500 max-w-md">
              Two loops by design: hostname first, then{' '}
              <code className="text-emerald-400/90">MODELS_CONFIG</code> after register.
            </p>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
              onClick={() => setOpen(false)}
            >
              Got it — start with bootstrap
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
