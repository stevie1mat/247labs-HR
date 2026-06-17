import * as React from "react";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = React.useState("");

  // Keep the input in sync with the URL if we are on the search page
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q !== null) {
      setQuery(q);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (query.trim()) {
        setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  return (
    <div className="relative min-w-0 sm:w-[280px] lg:w-[340px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        placeholder="Search jobs, templates, sources..."
        className="h-11 rounded-lg border-slate-200 bg-slate-50 pl-10 pr-4 text-sm shadow-none placeholder:text-slate-400 focus-visible:bg-white"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
