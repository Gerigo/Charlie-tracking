import { Route, Routes } from "react-router-dom";
import { Baby } from "lucide-react";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <Baby className="size-12 text-primary" />
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">
        Phase 0 — scaffold OK. Le contenu arrive aux phases suivantes.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Routes>
        <Route path="/" element={<Placeholder title="Charlie v2" />} />
        <Route path="*" element={<Placeholder title="404" />} />
      </Routes>
    </div>
  );
}
