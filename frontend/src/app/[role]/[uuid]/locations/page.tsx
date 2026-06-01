
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
import { getWorkingLocations, createWorkingLocation, updateWorkingLocation } from '@/api/working_locations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { userFriendlyError } from '@/lib/error-message';

export default function LocationsManagementPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [editingLoc, setEditingLoc] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', type: 'BRANCH' as const, address: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const loadLocations = async () => {
    try {
      const items = await getWorkingLocations();
      setLocations(items.working_locations || items);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Branches failed to load",
        description: userFriendlyError(error, "Please check your connection."),
      });
    }
  };

  useEffect(() => {
    loadNotifications();
    loadLocations();
  }, [toast]);

  // Dummy function just to satisfy the interval added in previous turn if I were to copy paste, but I don't need it here.
  const loadNotifications = () => {};

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    loc.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      await createWorkingLocation(newLoc);
      toast({ title: "Branch created", description: "The new branch is now available." });
      setIsCreateModalOpen(false);
      setNewLoc({ name: '', type: 'BRANCH', address: '' });
      loadLocations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: userFriendlyError(error, "Check for duplicate names or invalid data."),
      });
    }
  };

  const handleUpdate = async () => {
    try {
      await updateWorkingLocation(editingLoc.uuid, {
        name: editingLoc.name,
        type: editingLoc.type,
        address: editingLoc.address
      });
      toast({ title: "Branch updated", description: "The branch details were saved." });
      setEditingLoc(null);
      loadLocations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please check your input."),
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Branches</h1>
          <p className="text-muted-foreground">Manage headquarters and branch locations.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Branch
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search branches by name or address..." 
          className="pl-10 h-11 border-none bg-white shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Branch</TableHead>
              <TableHead className="font-bold">Type</TableHead>
              <TableHead className="font-bold">People and departments</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLocations.map((loc) => (
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

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>Add a headquarters or branch location.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input 
                placeholder="e.g. Kigali Branch"
                value={newLoc.name} 
                onChange={(e) => setNewLoc({...newLoc, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select onValueChange={(v: any) => setNewLoc({...newLoc, type: v})} value={newLoc.type}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HQ">Headquarters (HQ)</SelectItem>
                  <SelectItem value="BRANCH">Branch Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address or Region</Label>
              <Input 
                placeholder="Street address, City"
                value={newLoc.address} 
                onChange={(e) => setNewLoc({...newLoc, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Branch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLoc} onOpenChange={() => setEditingLoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>Update the branch name, type, or address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Branch Name</Label>
              <Input 
                value={editingLoc?.name || ''} 
                onChange={(e) => setEditingLoc({...editingLoc, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select onValueChange={(v: any) => setEditingLoc({...editingLoc, type: v})} value={editingLoc?.type}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HQ">Headquarters (HQ)</SelectItem>
                  <SelectItem value="BRANCH">Branch Office</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address or Region</Label>
              <Input 
                value={editingLoc?.address || ''} 
                onChange={(e) => setEditingLoc({...editingLoc, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLoc(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
