// src/app/about/HistoriaSection.tsx
"use client";

import Image from "next/image";

export default function HistoriaSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Historia</h2>

      <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 sm:p-6 md:p-8">
        {/* Text first, then images below */}
        <div className="space-y-6 md:space-y-8">
          {/* TEXT — full width */}
          <div className="text-white/90 text-justify leading-relaxed space-y-4">
            <p>
              Somos un equipo de dos estudiantes de ingeniería de sistemas de la
              Universidad EAFIT, Pablo y Felipe. Como universitarios promedio, nos
              gusta salir de fiesta, y encontramos que tanto para las personas como
              para los locales es vital contar con herramientas eficientes que
              faciliten la organización y disfrute.
            </p>
            <p>
              Por esto decidimos desarrollar una aplicación que no solo mejore la
              experiencia de quienes asisten a las fiestas, sino que también
              optimice la gestión para los locales. Estamos creando una solución
              innovadora que beneficie a todos.
            </p>
          </div>

          {/* IMAGES — horizontal layout below text */}
          <div className="flex flex-row justify-center items-center gap-6 sm:gap-8 md:gap-12">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full overflow-hidden ring-1 ring-white/15 flex-shrink-0">
              <Image
                src="/about/history-1.jpg"
                alt="Historia – foto 1"
                fill
                sizes="(min-width: 1024px) 224px, (min-width: 768px) 192px, (min-width: 640px) 160px, 128px"
                className="object-cover object-center"
                priority
              />
            </div>
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full overflow-hidden ring-1 ring-white/15 flex-shrink-0">
              <Image
                src="/about/history-2.jpeg"
                alt="Historia – foto 2"
                fill
                sizes="(min-width: 1024px) 224px, (min-width: 768px) 192px, (min-width: 640px) 160px, 128px"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
