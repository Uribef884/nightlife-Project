// src/app/about/page.tsx
import Image from "next/image";
import type { Metadata } from "next";
import HistoriaSection from "./HistoriaSection";

export const metadata: Metadata = {
  title: "Sobre nosotros – NightLife",
  description:
    "Conoce la misión, visión e historia de NightLife: conectamos personas y locales con tecnología para que las noches sean memorables.",
};

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <header className="pt-2">
        <h1 className="text-3xl font-bold text-white">Sobre nosotros</h1>
      </header>

      {/* Misión */}
      <section className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-white mb-3">Misión</h2>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr),22rem] gap-6 items-center">
          <p className="text-white/90 leading-relaxed">
            Conectar a las personas de manera auténtica, creando espacios para
            compartir momentos especiales y fortalecer lazos. Impulsamos
            experiencias seguras y fluidas entre clubes y asistentes mediante
            herramientas simples y modernas.
          </p>

          <div className="relative w-full h-44 sm:h-56 md:h-64 rounded-xl overflow-hidden ring-1 ring-white/10">
            <Image
              src="/about/mission.png" 
              alt="Ilustración de la misión de NightLife"
              fill
              sizes="(max-width: 768px) 100vw, 352px"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* Visión */}
      <section className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-white mb-3">Visión</h2>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr),22rem] gap-6 items-center">
          <p className="text-white/90 leading-relaxed">
            Brindar soluciones tecnológicas innovadoras que impulsen el
            desarrollo digital, transformando la manera en que las personas se
            conectan y disfrutan de sus noches. Queremos ser la plataforma que
            integra reservas, boletería y comunicación en un mismo lugar.
          </p>

          <div className="relative w-full h-44 sm:h-56 md:h-64 rounded-xl overflow-hidden ring-1 ring-white/10">
            <Image
              src="/about/vision.png" 
              alt="Ilustración de la visión de NightLife"
              fill
              sizes="(max-width: 768px) 100vw, 352px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Historia (ya creada como componente) */}
      <HistoriaSection />
    </div>
  );
}
