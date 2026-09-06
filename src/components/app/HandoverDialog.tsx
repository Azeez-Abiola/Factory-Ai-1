import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface HandoverDraft {
  keyEvents: string[];
  unresolvedIssues: string[];
  recommendations: string[];
  notes: string;
}

interface Member { user_id: string; display_name: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shiftName: string;
  draft: HandoverDraft;
  members: Member[];
  currentUserId: string | undefined;
  metricsSummary: { label: string; value: string }[];
  onSubmit: (payload: HandoverDraft & { incomingSupervisorId: string | null }) => Promise<void>;
}

const ListEditor = ({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder: string;
}) => {
  const [value, setValue] = useState("");
  const add = () => {
    if (!value.trim()) return;
    onChange([...items, value.trim()]);
    setValue("");
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} aria-label={`Add ${label}`}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={`${item}-${i}`} className="flex items-start gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
              <span className="flex-1">{item}</span>
              <button
                type="button"
                aria-label="Remove item"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const HandoverDialog = ({ open, onOpenChange, shiftName, draft, members, currentUserId, metricsSummary, onSubmit }: Props) => {
  const [keyEvents, setKeyEvents] = useState<string[]>([]);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [incoming, setIncoming] = useState<string>("unassigned");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKeyEvents(draft.keyEvents);
    setUnresolved(draft.unresolvedIssues);
    setRecommendations(draft.recommendations);
    setNotes(draft.notes);
    setIncoming("unassigned");
  }, [open, draft]);

  const submit = async () => {
    if (!notes.trim()) return toast.error("Add a short handover note for the next supervisor.");
    setSaving(true);
    try {
      await onSubmit({
        keyEvents, unresolvedIssues: unresolved, recommendations, notes: notes.trim(),
        incomingSupervisorId: incoming === "unassigned" ? null : incoming,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const candidates = members.filter((m) => m.user_id !== currentUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End shift &amp; hand over — {shiftName}</DialogTitle>
          <DialogDescription>
            We pre-filled what happened on your shift from live alerts and incidents. Review it, add anything the next
            supervisor must know, then hand over.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {metricsSummary.map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-bold">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-5 pt-2">
          <ListEditor label="Key events" items={keyEvents} onChange={setKeyEvents} placeholder="e.g. Line 2 stopped for 12 minutes" />
          <ListEditor label="Unresolved issues to carry over" items={unresolved} onChange={setUnresolved} placeholder="e.g. Gate sensor still faulty" />
          <ListEditor label="Recommendations for next shift" items={recommendations} onChange={setRecommendations} placeholder="e.g. Re-brief packing team on PPE" />

          <div className="space-y-2">
            <Label htmlFor="handover-notes">
              Handover note <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="handover-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Summarise the state of the floor for the incoming supervisor…"
            />
          </div>

          <div className="space-y-2">
            <Label>Hand over to</Label>
            <Select value={incoming} onValueChange={setIncoming}>
              <SelectTrigger><SelectValue placeholder="Select the incoming supervisor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Anyone on the next shift</SelectItem>
                {candidates.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The shift stays open for acceptance until the incoming supervisor signs it off.
            </p>
          </div>
        </div>

        <DialogFooter>
          {unresolved.length > 0 && (
            <Badge variant="outline" className="mr-auto bg-warning/10 text-warning border-warning/30">
              {unresolved.length} issue{unresolved.length > 1 ? "s" : ""} carried over
            </Badge>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            End shift &amp; send handover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HandoverDialog;
