import {
  BookOpenText,
  CheckCircle2,
  Library,
  PenTool,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AuthForm } from "@/components/forms/auth-form";

const roles = [
  { icon: Library, label: "Lector", text: "Compra, guarda y continúa leyendo." },
  { icon: PenTool, label: "Autor", text: "Publica y administra tus libros." },
  { icon: Users, label: "Afiliado", text: "Promociona títulos disponibles." },
  { icon: ShieldCheck, label: "Administrador", text: "Opera la plataforma." },
];

export default function AuthPage() {
  return (
    <main className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-blue-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan-200/30 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch lg:px-8">
        <section className="commercial-dark commercial-grid commercial-shine flex flex-col justify-between overflow-hidden rounded-[36px] p-7 shadow-[0_35px_90px_rgba(7,17,31,0.24)] sm:p-10">
          <div>
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#2b78ff] to-[#13b8e8] shadow-lg ring-1 ring-white/20">
              <BookOpenText className="h-6 w-6 text-white" />
            </span>
            <p className="mt-8 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Tu cuenta BestSeller
            </p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              Tus libros, compras y avances en un solo lugar.
            </h1>
            <p className="mt-5 max-w-xl leading-8 text-slate-300">
              Accede a tu biblioteca, administra publicaciones y utiliza las
              herramientas disponibles para tu perfil.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {roles.map(({ icon: Icon, label, text }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Icon className="h-4 w-4 text-cyan-300" />
                  {label}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="commercial-card flex flex-col justify-center rounded-[36px] p-7 sm:p-10 lg:p-12">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#155eef]">
            <CheckCircle2 className="h-4 w-4" />
            Acceso seguro
          </p>
          <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-[#07111f] sm:text-4xl">
            Bienvenido de nuevo
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Inicia sesión o crea una cuenta para comenzar.
          </p>
          <div className="mt-8">
            <AuthForm />
          </div>
        </section>
      </div>
    </main>
  );
}
