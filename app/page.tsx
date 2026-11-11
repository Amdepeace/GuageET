import { Dashboard } from "@/components/Dashboard";
import { loadData } from "@/lib/data";

export default function Page() {
  return <Dashboard data={loadData()} />;
}
