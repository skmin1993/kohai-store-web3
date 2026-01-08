import HomeIndex from "@/components/Home";
import SlugLayout from "@/components/Layouts/SlugLayout";

// Enable dynamic rendering for this route
export const dynamic = 'force-dynamic';

export default async function StoreShow({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <>
      <SlugLayout slug={slug}>
        <HomeIndex slug={slug} />
      </SlugLayout>
    </>
  );
}
