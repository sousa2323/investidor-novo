import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import { MobileNavigation } from "./mobile-navigation";
import { UserMenu } from "./user-menu";

interface AppHeaderProps {
  user: {
    name: string;
    email: string;
  };
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/92 px-4 backdrop-blur sm:px-6 lg:ml-64">
      <MobileNavigation />
      <div className="relative hidden w-full max-w-sm sm:block">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-9 bg-card pl-9"
          placeholder="Buscar ação ou FII"
          aria-label="Buscar ação ou FII"
        />
      </div>
      <div className="ml-auto">
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
