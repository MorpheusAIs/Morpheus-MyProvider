'use client';

import { useState } from 'react';
import { useApi } from '@/lib/ApiContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ApiConfig from '@/components/ApiConfig';
import WalletDisplay from '@/components/WalletDisplay';
import Bootstrap from '@/components/Bootstrap';
import ProviderTab from '@/components/ProviderTab';
import ModelTab from '@/components/ModelTab';
import Image from 'next/image';

export default function Home() {
  const { isConfigured } = useApi();

  return (
    <main className="min-h-screen">
      <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4 py-8">
          <div className="flex items-center justify-center gap-4">
            <div className="relative w-12 h-12">
              <Image 
                src="/images/mor_mark_white.png" 
                alt="Morpheus Logo" 
                fill
                style={{ objectFit: 'contain' }}
                className="opacity-90"
              />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              My Morpheus Provider
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage My Providers, Models and Bids for the Morpheus Proxy Router
          </p>
        </div>

        {/* Bootstrap Section - Help users get started */}
        {!isConfigured && <Bootstrap />}

        {/* API Configuration Section - Always Visible */}
        <ApiConfig />

        {/* Connected Info - Only show when configured */}
        {isConfigured && <WalletDisplay />}

        {/* Main Content - Only show when configured */}
        {isConfigured ? (
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-lg">
            <CardContent className="pt-6">
              <Tabs defaultValue="provider" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="provider" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Provider</TabsTrigger>
                  <TabsTrigger value="model" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Models & Bids</TabsTrigger>
                </TabsList>
                <TabsContent value="provider" className="mt-6">
                  <ProviderTab />
                </TabsContent>
                <TabsContent value="model" className="mt-6">
                  <ModelTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-yellow-400">Configuration Required</CardTitle>
              <CardDescription className="text-yellow-200/80">
                Please configure the API connection above to begin managing providers and models.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </main>
  );
}

