'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { Bid, Model } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Loader2, DollarSign } from 'lucide-react';
import { formatTimestamp, isValidPositiveNumber } from '@/lib/utils';
import { CONTRACT_MINIMUMS } from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * BidTab manages bid CRUD operations
 * - List all bids from blockchain
 * - Create new bids for models
 * - Model selection from available models
 */
export default function BidTab() {
  const { apiService, walletBalance } = useApi();
  const { success, error, warning } = useNotification();
  
  const [bids, setBids] = useState<Bid[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [selectedModelId, setSelectedModelId] = useState('');
  const [pricePerSecond, setPricePerSecond] = useState(CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN);

  const MIN_PRICE_PER_SECOND = CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN;

  useEffect(() => {
    if (apiService) {
      loadBids();
      loadModels();
    }
  }, [apiService]);

  const loadBids = async () => {
    if (!apiService) return;
    
    setIsLoading(true);
    try {
      const data = await apiService.getBids();
      setBids(data);
    } catch (err) {
      error('Failed to Load', ApiService.parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadModels = async () => {
    if (!apiService) return;
    
    try {
      const data = await apiService.getModels();
      setModels(data.filter(m => !m.IsDeleted));
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const handleCreateBid = async () => {
    if (!apiService || !walletBalance) return;

    // Validation
    if (!selectedModelId) {
      warning('Validation Error', 'Please select a model');
      return;
    }

    if (!isValidPositiveNumber(pricePerSecond)) {
      warning('Validation Error', 'Please enter a valid price per second');
      return;
    }

    const priceNum = parseInt(pricePerSecond);
    if (priceNum < parseInt(MIN_PRICE_PER_SECOND)) {
      warning(
        'Price Too Low',
        `Minimum price per second is ${MIN_PRICE_PER_SECOND} wei`
      );
      return;
    }

    setIsCreating(true);
    try {
      const bid = await apiService.createBid({
        modelID: selectedModelId,
        pricePerSecond: pricePerSecond,
      });

      success(
        'Bid Created',
        `Bid created with price ${pricePerSecond} wei/sec`
      );
      
      // Reset form and reload
      setSelectedModelId('');
      setPricePerSecond(MIN_PRICE_PER_SECOND);
      setIsDialogOpen(false);
      await loadBids();
    } catch (err) {
      error('Bid Creation Failed', ApiService.parseError(err));
    } finally {
      setIsCreating(false);
    }
  };

  const getModelName = (modelId: string): string => {
    const model = models.find(m => m.Id === modelId);
    return model?.Name || 'Unknown Model';
  };

  const isMyBid = (bid: Bid) => {
    if (!walletBalance?.address || !bid.Provider) return false;
    return walletBalance.address.toLowerCase() === bid.Provider.toLowerCase();
  };

  const isActive = (bid: Bid) => {
    return bid.DeletedAt === '0';
  };

  return (
    <div className="space-y-6">
      {/* Create Bid Button & Dialog */}
      <Card className="border-gray-700 bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Bid
          </CardTitle>
          <CardDescription>
            Create a bid for a model (Min price: {MIN_PRICE_PER_SECOND} wei/sec)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <DollarSign className="mr-2 h-4 w-4" />
                Create New Bid
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 border-gray-700">
              <DialogHeader>
                <DialogTitle>Create Bid</DialogTitle>
                <DialogDescription>
                  Select a model and set your price per second
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modelSelect">Select Model</Label>
                  <select
                    id="modelSelect"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-input px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">-- Select a Model --</option>
                    {models.map((model) => (
                      <option key={model.Id} value={model.Id}>
                        {model.Name} ({model.Owner.substring(0, 10)}...)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {models.length} models available
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price Per Second (wei)</Label>
                  <Input
                    id="price"
                    type="text"
                    placeholder={MIN_PRICE_PER_SECOND}
                    value={pricePerSecond}
                    onChange={(e) => setPricePerSecond(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: {MIN_PRICE_PER_SECOND} wei/sec
                  </p>
                </div>

                <Button
                  onClick={handleCreateBid}
                  disabled={isCreating || !apiService}
                  className="w-full"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Bid'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Bids List */}
      <Card className="border-gray-700 bg-gray-800/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Bids</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadBids}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            All bids registered on the blockchain
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : bids.length === 0 ? (
            <p className="text-center text-gray-400 py-8">
              No bids found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Price/Sec</TableHead>
                  <TableHead>Nonce</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bids.map((bid) => (
                  <TableRow key={bid.Id}>
                    <TableCell className="font-semibold">
                      {getModelName(bid.ModelAgentId)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {bid.Provider.substring(0, 10)}...
                      {isMyBid(bid) && (
                        <Badge variant="default" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-green-400">
                      {parseInt(bid.PricePerSecond).toLocaleString()} wei/sec
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bid.Nonce}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatTimestamp(bid.CreatedAt)}
                    </TableCell>
                    <TableCell>
                      {isActive(bid) ? (
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Deleted</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

