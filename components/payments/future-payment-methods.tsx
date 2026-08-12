type ProviderProps = {
  name: string;
  initials: string;
  accentClassName: string;
};

function FutureProvider({
  name,
  initials,
  accentClassName,
}: ProviderProps) {
  return (
    <div
      aria-disabled="true"
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-55 grayscale"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-black text-white ${accentClassName}`}
        >
          {initials}
        </span>

        <div>
          <p className="font-black text-slate-700">{name}</p>
          <p className="text-xs font-semibold text-slate-500">
            Próximamente
          </p>
        </div>
      </div>
    </div>
  );
}

export function FuturePaymentMethods() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FutureProvider
        name="AZUL"
        initials="AZ"
        accentClassName="bg-blue-700"
      />
      <FutureProvider
        name="CardNET"
        initials="CN"
        accentClassName="bg-red-700"
      />
    </div>
  );
}
