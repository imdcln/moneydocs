import PageLoading from "@/components/ui/PageLoading";

export default function Loading() {
  return (
    <PageLoading
      title="Loading..."
      subtitle="Preparing page content"
      fullScreen={false}
      className="min-h-[70vh]"
    />
  );
}
