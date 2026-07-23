"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { NavigationList } from "./navigation-list";

export function MobileNavigation() {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-80 p-0">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <BrandMark />
        </SheetHeader>
        <div className="p-3">
          <NavigationList onNavigate={() => setNavigationOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
