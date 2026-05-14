import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function Home() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-6">
        <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
          Fullstack Starter
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Production-ready monorepo for a growing team.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          Built with React, Vite, Express, Prisma, MongoDB, and a
          collaboration-first workflow for five developers.
        </p>
        <div className="flex gap-3">
          <Button as="a" href="/register">
            Get started
          </Button>
          <Link
            to="/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            View dashboard
          </Link>
        </div>
      </section>
      <Card>
        <h2 className="text-xl font-semibold">Starter highlights</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          <li>• Monorepo with client and server</li>
          <li>• Auth-ready API structure</li>
          <li>• Reusable UI and route guards</li>
          <li>• CI, linting, and formatting support</li>
        </ul>
      </Card>
    </div>
  );
}
