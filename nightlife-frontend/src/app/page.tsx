import Image from "next/image";
import { api } from "@/lib/apiClient";
import { ENDPOINTS } from "@/lib/endpoints";

type Club = {
  id: string;
  name: string;
  address?: string;
  profileImageUrl?: string; // guessing from your data shape; fallback handled
};

export default async function Home() {
  let clubs: Club[] = [];
  try {
    clubs = await api.get<Club[]>(ENDPOINTS.clubs.list);
  } catch (e: any) {
    console.error("Failed to fetch clubs:", e?.message ?? e);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl md:text-4xl font-bold text-violet-300">NightLife Frontend is Live 🎉</h1>

      {/* Responsive Grid: 1 col on mobile, 2 on sm, 3 on lg */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <article
            key={club.id}
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow"
          >
            <div className="relative h-40 w-full">
              <Image
                src={
                  club.profileImageUrl ??
                  "https://nightlife-files.s3.amazonaws.com/placeholder/club-placeholder.jpg"
                }
                alt={club.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                priority={false}
              />
            </div>
            <div className="p-4">
              <h2 className="truncate text-lg font-semibold text-slate-100">{club.name}</h2>
              {club.address && <p className="mt-1 line-clamp-2 text-sm text-slate-400">{club.address}</p>}
              <div className="mt-3">
                <a
                  href={`/clubs/${club.id}`}
                  className="inline-flex items-center rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Ver club
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
