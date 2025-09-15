import { GlobalModal } from "@/components/ui/GlobalModal";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GlobalModal />
    </>
  );
}
