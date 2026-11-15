"use client";
// ⌘K / Ctrl+K command palette built on cmdk (MIT, https://github.com/pacocoursey/cmdk):
// jump to any vital, desk, infrastructure record or dashboard section.
import { useEffect, useState } from "react";
import { Command } from "cmdk";

export type PaletteItem = { id: string; group: string; label: string; hint?: string; run: () => void };

export function CommandPalette({ items, open, onOpenChange }: { items: PaletteItem[]; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label="Search the dashboard" className="cmdk" filter={(value, search) => (value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
      <Command.Input value={q} onValueChange={setQ} placeholder="Search vitals, desks, infrastructure, sections…" />
      <Command.List>
        <Command.Empty>No match.</Command.Empty>
        {groups.map((g) => (
          <Command.Group key={g} heading={g}>
            {items
              .filter((i) => i.group === g)
              .map((i) => (
                <Command.Item
                  key={i.id}
                  value={`${i.label} ${i.hint ?? ""}`}
                  onSelect={() => {
                    onOpenChange(false);
                    i.run();
                  }}
                >
                  <span>{i.label}</span>
                  {i.hint && <span className="muted">{i.hint}</span>}
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
