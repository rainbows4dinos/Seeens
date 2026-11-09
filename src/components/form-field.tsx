// The label, hint, and error around a form control, shared by the Add form
// and the profile page (#126).

export function invalid(id: string, error?: string, extraDescribedBy?: string) {
  const describedBy = [error ? `${id}-error` : null, extraDescribedBy].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: React.ReactNode;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="-mt-1 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-error">
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}
