import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <h1 className="text-5xl font-bold">404</h1>
        <p className="mt-3 text-slate-600">Page not found.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-white"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
