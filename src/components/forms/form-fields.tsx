"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { NumericFormat, type NumericFormatProps } from "react-number-format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { FormMessage } from "./form-message";

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
  className,
}: FieldShellProps) {
  const descriptionId = `${id}-description`;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{
              "aria-describedby"?: string;
              "aria-invalid"?: boolean;
            }>,
            {
              "aria-describedby": hint || error ? descriptionId : undefined,
              "aria-invalid": Boolean(error),
            },
          )
        : children}
      <div id={descriptionId}>
        {error ? (
          <FormMessage message={error} />
        ) : hint ? (
          <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export interface TextFieldProps extends React.ComponentProps<typeof Input> {
  label: string;
  error?: string;
  hint?: string;
  fieldClassName?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { id, label, error, hint, required, fieldClassName, className, ...inputProps },
    reference,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? inputProps.name ?? generatedId;

    return (
      <FieldShell
        id={inputId}
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={fieldClassName}
      >
        <Input
          ref={reference}
          id={inputId}
          required={required}
          className={cn("h-10 bg-card px-3", className)}
          {...inputProps}
        />
      </FieldShell>
    );
  },
);

export const EmailField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function EmailField(props, reference) {
    return (
      <TextField
        ref={reference}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        {...props}
      />
    );
  },
);

export const PasswordField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function PasswordField(
    { id, label, error, hint, required, fieldClassName, className, ...inputProps },
    reference,
  ) {
    const [passwordVisible, setPasswordVisible] = React.useState(false);
    const generatedId = React.useId();
    const inputId = id ?? inputProps.name ?? generatedId;

    return (
      <FieldShell
        id={inputId}
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={fieldClassName}
      >
        <div className="relative">
          <Input
            ref={reference}
            id={inputId}
            type={passwordVisible ? "text" : "password"}
            required={required}
            className={cn("h-10 bg-card px-3 pr-11", className)}
            {...inputProps}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 size-8 text-muted-foreground hover:text-foreground"
            onClick={() => setPasswordVisible((currentValue) => !currentValue)}
            aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={passwordVisible}
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
      </FieldShell>
    );
  },
);

interface NumericFieldProps
  extends Omit<NumericFormatProps, "customInput" | "onValueChange"> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  onNumericValueChange?: (numericValue: number | undefined) => void;
}

function NumericField({
  id,
  label,
  error,
  hint,
  required,
  onNumericValueChange,
  className,
  ...numericProps
}: NumericFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
    >
      <NumericFormat
        id={id}
        customInput={Input}
        required={required}
        className={cn("numeric h-10 bg-card px-3", className)}
        decimalSeparator=","
        thousandSeparator="."
        allowedDecimalSeparators={[",", "."]}
        onValueChange={(values) => onNumericValueChange?.(values.floatValue)}
        {...numericProps}
      />
    </FieldShell>
  );
}

export function MoneyField(props: NumericFieldProps) {
  return (
    <NumericField
      prefix="R$ "
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      {...props}
    />
  );
}

export function PercentageField(props: NumericFieldProps) {
  return (
    <NumericField
      suffix="%"
      decimalScale={2}
      allowNegative={false}
      isAllowed={(values) =>
        values.floatValue === undefined || values.floatValue <= 100
      }
      {...props}
    />
  );
}

export function QuantityField(props: NumericFieldProps) {
  return (
    <NumericField
      decimalScale={8}
      allowNegative={false}
      {...props}
    />
  );
}

export const DateField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function DateField(props, reference) {
    return <TextField ref={reference} type="date" {...props} />;
  },
);

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

export function SelectField({
  id,
  label,
  value,
  placeholder,
  options,
  error,
  hint,
  required,
  disabled,
  onValueChange,
}: SelectFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
    >
      <Select
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <SelectTrigger id={id} className="h-10 w-full bg-card">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
