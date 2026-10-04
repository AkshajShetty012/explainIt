import DocumentOCR from "../components/DocumentOCR";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-5 pb-10 pt-5 sm:px-8 sm:pb-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_50%_10%,rgba(245,232,203,0.7),transparent_43%),radial-gradient(circle_at_10%_30%,rgba(255,246,225,0.8),transparent_25%)]" />
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-sm text-white">E</span>ExplainIt</Link>
        <span className="hidden rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600 sm:block">Simple document explanations</span>
      </header>
      <DocumentOCR />
    </main>
  );
}
