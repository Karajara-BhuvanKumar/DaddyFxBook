import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoadError({ name, retry }: { name: string; retry: () => unknown }) {
  return <div role="alert" className="rounded-2xl border border-border bg-card p-6 space-y-3 text-sm">
    <div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-5 w-5 text-destructive" />Couldn't load {name}.</div>
    <p className="text-muted-foreground">Your saved records have not changed. Check your connection and try again.</p>
    <Button variant="outline" onClick={() => void retry()}>Try again</Button>
  </div>;
}
