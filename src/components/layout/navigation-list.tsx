"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import { navigationItems } from "./navigation-items";

interface NavigationListProps {
  onNavigate?: () => void;
}

export function NavigationList({ onNavigate }: NavigationListProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="grid gap-1">
      {navigationItems.map((navigationItem) => {
        const Icon = navigationItem.icon;
        const active =
          pathname === navigationItem.href ||
          (navigationItem.href !== "/painel" &&
            pathname.startsWith(`${navigationItem.href}/`));

        return (
          <Link
            key={navigationItem.href}
            href={navigationItem.href}
            onClick={onNavigate}
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active &&
                "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--primary)]",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4.5" aria-hidden="true" />
            {navigationItem.label}
          </Link>
        );
      })}
    </nav>
  );
}
