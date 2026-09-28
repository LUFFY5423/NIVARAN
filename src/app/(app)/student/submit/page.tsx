import { getSession } from "@/server/auth";
import { findUserById } from "@/server/repo/reference-data";
import { listCategories, listHostels, listBlocks, listRooms } from "@/server/repo/reference-data";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/primitives";
import { SubmitComplaintForm } from "@/components/complaints/submit-form";

export default async function SubmitComplaintPage() {
  const session = await getSession();
  if (!session) return null;
  const me = findUserById(session.id);
  const categories = listCategories();
  const hostels = listHostels();
  const blocks = listBlocks();
  const rooms = listRooms();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Submit a Complaint"
        description="Give as much detail as possible so staff can resolve it quickly."
      />
      <Card>
        <CardContent className="pt-5">
          <SubmitComplaintForm
            categories={categories}
            hostels={hostels}
            blocks={blocks}
            rooms={rooms}
            defaultRoomId={me?.roomId ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
