"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function ComponentGalleryPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Design system · Phase 1
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Component gallery
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          shadcn/ui primitives installed for university and platform dashboards.
          Not installed in Expo native apps.
        </p>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to destinations
        </Link>
      </header>

      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="overlays">Overlays</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Buttons & badges</CardTitle>
              <CardDescription>
                Primary forest teal, SOS destructive, status badges.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Escalate</Button>
              <Button
                variant="outline"
                onClick={() => toast("Broadcast queued", { description: "Campus North" })}
              >
                Toast
              </Button>
              <Badge>Open</Badge>
              <Badge variant="secondary">En route</Badge>
              <Badge variant="outline">Resolved</Badge>
              <Badge variant="destructive">Critical</Badge>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Table & form controls</CardTitle>
              <CardDescription>Incident list and filter patterns.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid max-w-sm gap-2">
                <Label htmlFor="site">Site filter</Label>
                <Input id="site" placeholder="Campus North" />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Incident</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>SOS-1042</TableCell>
                    <TableCell>Main campus</TableCell>
                    <TableCell>Dispatched</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>ESC-881</TableCell>
                    <TableCell>Residence East</TableCell>
                    <TableCell>Open</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overlays" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dialog & sheet</CardTitle>
              <CardDescription>
                Confirmation flows and incident drawers.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger
                  render={<Button variant="outline">Open dialog</Button>}
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reassign incident</DialogTitle>
                    <DialogDescription>
                      Confirm reassignment to another approved responder.
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger
                  render={<Button>Open incident drawer</Button>}
                />
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Incident SOS-1042</SheetTitle>
                    <SheetDescription>
                      Drawer shell for live incident detail (Phase 5).
                    </SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
