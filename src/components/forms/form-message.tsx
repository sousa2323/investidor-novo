import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface FormMessageProps {
  message?: string;
  variant?: "error" | "success" | "hint";
  className?: string;
}

export function FormMessage({
  message,
  variant = "error",
  className,
}: FormMessageProps) {
  if (!message) {
    return null;
  }

  const Icon = variant === "success" ? CircleCheck : CircleAlert;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs leading-5",
        variant === "error" && "text-destructive",
        variant === "success" && "text-primary",
        variant === "hint" && "text-muted-foreground",
        className,
      )}
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}
