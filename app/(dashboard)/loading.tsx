import PageLoading from "@/components/ui/PageLoading";

export default function AdminLoading() {
  return (
    <PageLoading
      title="Loading..."
      subtitle="Fetching your financial data"
      fullScreen={false}
      className="min-h-[70vh]"
    />
  );
}
