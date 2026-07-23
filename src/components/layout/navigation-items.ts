import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  Heart,
  LayoutDashboard,
  PieChart,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";

export const navigationItems = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/acoes", label: "Ações", icon: BarChart3 },
  { href: "/fiis", label: "FIIs", icon: Building2 },
  { href: "/carteira", label: "Carteira", icon: WalletCards },
  { href: "/planejador", label: "Planejador", icon: BadgeDollarSign },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: SlidersHorizontal },
] as const;

export const secondaryNavigationItems = [
  { href: "/carteira/movimentacoes", label: "Movimentações", icon: PieChart },
] as const;
