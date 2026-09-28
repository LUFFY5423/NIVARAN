import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { listHostels, listBlocks, listRooms } from "@/server/repo/reference-data";
import { PublicHeader } from "@/components/layout/public-header";
import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardContent } from "@/components/ui/primitives";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/post-login");

  const hostels = listHostels();
  const blocks = listBlocks();
  const rooms = listRooms();

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">Create your student account</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Register to submit and track hostel complaints</p>

        <Card className="mt-8">
          <CardContent className="pt-5">
            <RegisterForm hostels={hostels} blocks={blocks} rooms={rooms} />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
