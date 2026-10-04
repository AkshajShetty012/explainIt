import DocumentOCR from "../components/DocumentOCR";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <h1 className="text-3xl font-semibold">ExplainIt</h1>
      <DocumentOCR />
    </main>
  );
}
