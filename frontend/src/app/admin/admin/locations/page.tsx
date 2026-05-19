
"use client";

import React, { useEffect, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { MapPin, Plus, Search, Building2, Users, MoreVertical, Edit, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getWorkingLocations } from '@/api/working_locations';

export default function LocationsManagementPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [editingLoc, setEditingLoc] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getWorkingLocations()
      .then((items) => setLocations(items))
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Locations failed to load",
          description: error?.response?.data?.message ?? "Please check your backend connection.",
        });
      });
  }, [toast]);

  const handleUpdate = () => {
    setLocations(locations.map(l => l.id === editingLoc.id ? editingLoc : l));
    toast({ title: "Location Updated", description: "Node parameters have been synchronized." });
    setEditingLoc(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Organizational Nodes</h1>
          <p className="text-muted-foreground">Manage physical and virtual working locations across the group.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Provision Location
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search locations by name or address..." 
          className="pl-10 h-11 border-none bg-white shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Location Name</TableHead>
              <TableHead className="font-bold">Classification</TableHead>
              <TableHead className="font-bold">Asset Allocation</TableHead>
              <TableHead className="font-bold">Operational Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((loc) => (
              <TableRow key={loc.id} className="hover:bg-secondary/10 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold">{loc.name}</span>
                      <span className="text-xs text-muted-foreground">{loc.address}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-bold tracking-wider">{loc.type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" /> {loc._count?.users ?? 0}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" /> {loc._count?.departments ?? 0}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Operational</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingLoc(loc)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Details
                      </DropdownMenuItem>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuItem className="text-muted-foreground opacity-50 cursor-not-allowed">
                              <ShieldAlert className="mr-2 h-4 w-4" /> Deletion Restricted
                            </DropdownMenuItem>
                          </TooltipTrigger>
                          <TooltipContent>
                            Node deletion is restricted to protect corporate hierarchy.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingLoc} onOpenChange={() => setEditingLoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location Metadata</DialogTitle>
            <DialogDescription>Update the physical or operational parameters of the organizational node.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Location Name</Label>
              <Input 
                value={editingLoc?.name || ''} 
                onChange={(e) => setEditingLoc({...editingLoc, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Address/Region</Label>
              <Input 
                value={editingLoc?.address || ''} 
                onChange={(e) => setEditingLoc({...editingLoc, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLoc(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Commit Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
