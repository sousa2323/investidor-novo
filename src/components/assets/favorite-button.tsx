"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { toggleFavoriteAction } from "@/app/actions/favorite-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  ticker: string;
  assetType: "STOCK" | "FII";
  initialFavorited?: boolean;
  showLabel?: boolean;
}

export function FavoriteButton({
  ticker,
  assetType,
  initialFavorited = false,
  showLabel = false,
}: FavoriteButtonProps) {
  const [pending, startTransition] = useTransition();
  const [favorited, setOptimisticFavorited] = useOptimistic(initialFavorited);

  function toggleFavorite() {
    startTransition(async () => {
      setOptimisticFavorited(!favorited);
      const result = await toggleFavoriteAction(ticker, assetType);
      toast[result.favorited ? "success" : "message"](result.message);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={showLabel ? "sm" : "icon-sm"}
      onClick={toggleFavorite}
      disabled={pending}
      className={cn(favorited && "text-primary")}
      aria-label={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={favorited}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Heart
          className={cn(favorited && "fill-current")}
          aria-hidden="true"
        />
      )}
      {showLabel ? (favorited ? "Favoritado" : "Favoritar") : null}
    </Button>
  );
}
