import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { requireCurrentUser } from "@/lib/dal/session";

export default async function ProtectedAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await requireCurrentUser();

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <AppHeader user={currentUser} />
      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
