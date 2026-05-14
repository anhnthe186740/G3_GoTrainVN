import { Card } from "../components/ui/Card";

export function Dashboard() {
  return (
    <div className="grid gap-6">
      <Card>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Protected workspace for authenticated users.
        </p>
      </Card>
    </div>
  );
}
