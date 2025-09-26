// src/components/domain/home/SSRClubGrid.tsx
// NOTE: This is a Server Component (no "use client")
import { ClubCard } from "./ClubCard"; // path assumes the file is src/components/domain/home/clubCard.tsx
import type { ClubListItem } from "@/services/clubs.service";

export default function SSRClubGrid({ items }: { items: ClubListItem[] }) {
  if (!items?.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white/70">
        No encontramos clubes con esos filtros.
      </div>
    );
  }

  return (
    <div
      className="
        grid gap-4
        grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
      "
    >
      {items.map((c) => (
        <ClubCard
          key={c.id}
          club={{
            id: c.id,
            name: c.name,
            address: c.address,
            profileImageUrl: c.profileImageUrl ?? undefined,
          } as CardClub /* matches your ClubCard: Pick<Club,'id'|'name'|'address'|'profileImageUrl'> */}
        />
      ))}
    </div>
  );
}
