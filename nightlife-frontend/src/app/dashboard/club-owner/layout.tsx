import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Club Dashboard - NightLife',
  description: 'Manage your club operations, tickets, events, and more',
};

export default function ClubOwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
}
