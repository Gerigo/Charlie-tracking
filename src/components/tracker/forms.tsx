import { useState } from "react";
import {
  FieldLabel,
  FormHeader,
  NoteField,
  Segmented,
  Sheet,
  Stepper,
  SubmitBar,
  TimeField,
} from "@/components/ui/primitives";
import { IconCaca, IconPipi } from "@/components/ui/icons";
import { TONES } from "@/lib/theme";
import { pad2 } from "@/lib/dates";
import {
  addInstantEvent,
  CARE_OPTIONS,
  deleteEvent,
  editEvent,
  type AppEvent,
  type CareData,
  type DiaperData,
  type FeedData,
  type PumpData,
  type TempData,
  type TimeOfDay,
} from "@/lib/events";

export type SheetState =
  | { type: "feed" | "pump" | "diaper" | "care" | "temp" }
  | { type: "edit"; event: AppEvent }
  | null;

function nowHM(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function parseHM(s: string): TimeOfDay {
  const [h, m] = s.split(":").map(Number);
  return { h, m };
}

function FeedForm({
  suggestBreast,
  onDone,
}: {
  suggestBreast: "G" | "D";
  onDone: () => void;
}) {
  const [kind, setKind] = useState<"sein" | "biberon">("sein");
  const [breast, setBreast] = useState<"G" | "D">(suggestBreast);
  const [ml, setMl] = useState(120);
  const [time, setTime] = useState(nowHM());
  const [note, setNote] = useState("");
  return (
    <div>
      <FormHeader title="Nouvelle tétée" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <FieldLabel>Type</FieldLabel>
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "sein", label: "Sein" },
              { value: "biberon", label: "Biberon" },
            ]}
          />
        </div>
        {kind === "sein" && (
          <div>
            <FieldLabel>Sein</FieldLabel>
            <div style={{ display: "flex", gap: 10 }}>
              {(["G", "D"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBreast(b)}
                  style={{
                    flex: 1,
                    padding: "16px 12px",
                    borderRadius: 14,
                    background: breast === b ? TONES.sand.bg : "#fff",
                    border: `1px solid ${
                      breast === b ? TONES.sand.ink + "40" : "rgba(0,0,0,0.08)"
                    }`,
                    color: breast === b ? TONES.sand.ink : "#2A2620",
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.6,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    Côté
                  </div>
                  <div style={{ fontSize: 18, marginTop: 2 }}>
                    {b === "G" ? "Gauche" : "Droit"}
                  </div>
                  {b === suggestBreast && (
                    <div
                      style={{
                        fontSize: 10.5,
                        marginTop: 4,
                        opacity: 0.65,
                        fontWeight: 500,
                      }}
                    >
                      suggéré (alterné)
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "biberon" && (
          <div>
            <FieldLabel>Quantité</FieldLabel>
            <Stepper
              value={ml}
              onChange={setMl}
              min={10}
              max={300}
              step={10}
              unit=" ml"
            />
          </div>
        )}
        <div>
          <FieldLabel>Heure</FieldLabel>
          <TimeField value={time} onChange={setTime} />
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={async () => {
          const data: FeedData = {
            kind,
            breast: kind === "sein" ? breast : null,
            ml: kind === "biberon" ? ml : null,
            note,
          };
          await addInstantEvent("feed", parseHM(time), data, note);
          onDone();
        }}
      />
    </div>
  );
}

function PumpForm({ onDone }: { onDone: () => void }) {
  const [breast, setBreast] = useState<"G" | "D" | "GD">("G");
  const [ml, setMl] = useState(110);
  const [time, setTime] = useState(nowHM());
  const [note, setNote] = useState("");
  return (
    <div>
      <FormHeader title="Tirage de lait" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <FieldLabel>Sein</FieldLabel>
          <Segmented
            value={breast}
            onChange={setBreast}
            options={[
              { value: "G", label: "Gauche" },
              { value: "D", label: "Droit" },
              { value: "GD", label: "Les deux" },
            ]}
          />
        </div>
        <div>
          <FieldLabel>Quantité tirée</FieldLabel>
          <Stepper
            value={ml}
            onChange={setMl}
            min={5}
            max={400}
            step={5}
            unit=" ml"
          />
        </div>
        <div>
          <FieldLabel>Heure</FieldLabel>
          <TimeField value={time} onChange={setTime} />
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField
            value={note}
            onChange={setNote}
            placeholder="Confort, flux, contexte…"
          />
        </div>
      </div>
      <SubmitBar
        onClick={async () => {
          const data: PumpData = { breast, ml, note };
          await addInstantEvent("pump", parseHM(time), data, note);
          onDone();
        }}
      />
    </div>
  );
}

function DiaperForm({ onDone }: { onDone: () => void }) {
  const [pipi, setPipi] = useState(true);
  const [caca, setCaca] = useState(false);
  const [color, setColor] = useState("jaune");
  const [time, setTime] = useState(nowHM());
  const [note, setNote] = useState("");
  const colors = [
    { v: "jaune", l: "Jaune", sw: "#E8C76A" },
    { v: "moutarde", l: "Moutarde", sw: "#B98A2E" },
    { v: "vert", l: "Verdâtre", sw: "#8AA070" },
    { v: "marron", l: "Marron", sw: "#7A5238" },
  ];
  const pill = (active: boolean) => ({
    flex: 1,
    padding: "16px 12px",
    borderRadius: 14,
    background: active ? TONES.olive.bg : "#fff",
    border: `1px solid ${
      active ? TONES.olive.ink + "40" : "rgba(0,0,0,0.08)"
    }`,
    color: active ? TONES.olive.ink : "#2A2620",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  });
  return (
    <div>
      <FormHeader title="Couche" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <FieldLabel>Contenu</FieldLabel>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setPipi(!pipi)} style={pill(pipi)}>
              <IconPipi size={18} /> Pipi
            </button>
            <button onClick={() => setCaca(!caca)} style={pill(caca)}>
              <IconCaca size={18} /> Caca
            </button>
          </div>
        </div>
        {caca && (
          <div>
            <FieldLabel>Couleur</FieldLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {colors.map((c) => (
                <button
                  key={c.v}
                  onClick={() => setColor(c.v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: color === c.v ? "#2A2620" : "#fff",
                    color: color === c.v ? "#FAF9F5" : "#2A2620",
                    border: "1px solid rgba(0,0,0,0.08)",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: c.sw,
                      border: "1px solid rgba(0,0,0,0.1)",
                    }}
                  />
                  {c.l}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <FieldLabel>Heure</FieldLabel>
          <TimeField value={time} onChange={setTime} />
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={async () => {
          const data: DiaperData = {
            pipi,
            caca,
            color: caca ? color : null,
            note,
          };
          await addInstantEvent("diaper", parseHM(time), data, note);
          onDone();
        }}
      />
    </div>
  );
}

function CareForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState("vitamine_d");
  const [custom, setCustom] = useState("");
  const [time, setTime] = useState(nowHM());
  const [note, setNote] = useState("");
  return (
    <div>
      <FormHeader title="Soins" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <FieldLabel>Type</FieldLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {CARE_OPTIONS.map((o) => (
              <button
                key={o.v}
                onClick={() => setKind(o.v)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  textAlign: "left",
                  background: kind === o.v ? TONES.sky.bg : "#fff",
                  border: `1px solid ${
                    kind === o.v ? TONES.sky.ink + "40" : "rgba(0,0,0,0.08)"
                  }`,
                  color: kind === o.v ? TONES.sky.ink : "#2A2620",
                  fontWeight: 600,
                  fontSize: 13.5,
                  letterSpacing: "-0.005em",
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        {kind === "custom" && (
          <div>
            <FieldLabel>Détail</FieldLabel>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="ex: tire-lait, peau à peau…"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "#fff",
                fontFamily: "inherit",
                fontSize: 14,
              }}
            />
          </div>
        )}
        <div>
          <FieldLabel>Heure</FieldLabel>
          <TimeField value={time} onChange={setTime} />
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={async () => {
          const data: CareData = {
            kind,
            custom: kind === "custom" ? custom : null,
            note,
          };
          await addInstantEvent("care", parseHM(time), data, note);
          onDone();
        }}
      />
    </div>
  );
}

function TempForm({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState(36.8);
  const [slot, setSlot] = useState<"matin" | "soir">("matin");
  const [time, setTime] = useState(nowHM());
  const [note, setNote] = useState("");
  const round = (n: number) => +n.toFixed(1);
  return (
    <div>
      <FormHeader title="Température" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <FieldLabel>Moment</FieldLabel>
          <Segmented
            value={slot}
            onChange={setSlot}
            options={[
              { value: "matin", label: "Matin" },
              { value: "soir", label: "Soir" },
            ]}
          />
        </div>
        <div>
          <FieldLabel>Mesure</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setValue(round(value - 0.1))}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                fontSize: 22,
              }}
            >
              −
            </button>
            <div
              className="serif num"
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 52,
                color: value > 38 ? "#9A4F3F" : "#2A2620",
              }}
            >
              {value.toFixed(1)}°
            </div>
            <button
              onClick={() => setValue(round(value + 0.1))}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                fontSize: 22,
              }}
            >
              +
            </button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(0,0,0,0.45)",
              textAlign: "center",
              marginTop: 6,
            }}
          >
            {value < 36
              ? "Hypothermie possible"
              : value > 38
                ? "⚠ Fièvre"
                : value > 37.5
                  ? "Légèrement élevé"
                  : "Plage normale"}
          </div>
        </div>
        <div>
          <FieldLabel>Heure</FieldLabel>
          <TimeField value={time} onChange={setTime} />
        </div>
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={async () => {
          const data: TempData = { value, slot, note };
          await addInstantEvent("temp", parseHM(time), data, note);
          onDone();
        }}
      />
    </div>
  );
}

function EditForm({
  event,
  onDone,
}: {
  event: AppEvent;
  onDone: () => void;
}) {
  const [time, setTime] = useState(
    `${pad2(event.start.getHours())}:${pad2(event.start.getMinutes())}`,
  );
  const hasEnd = event.end != null && event.durMin > 0;
  const [endTime, setEndTime] = useState(
    event.end
      ? `${pad2(event.end.getHours())}:${pad2(event.end.getMinutes())}`
      : "",
  );
  const [note, setNote] = useState(event.data.note ?? "");
  const labels: Record<AppEvent["type"], string> = {
    sleep: "Sommeil",
    feed: "Tétée",
    pump: "Tirage",
    diaper: "Couche",
    care: "Soins",
    temp: "Température",
  };
  return (
    <div>
      <FormHeader title={`Modifier · ${labels[event.type]}`} />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <FieldLabel>Heure</FieldLabel>
          <TimeField value={time} onChange={setTime} />
        </div>
        {hasEnd && (
          <div>
            <FieldLabel>Fin</FieldLabel>
            <TimeField value={endTime} onChange={setEndTime} />
          </div>
        )}
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField
            value={note}
            onChange={setNote}
            placeholder="Note libre…"
          />
        </div>
      </div>
      <SubmitBar
        onClick={async () => {
          await editEvent(event.id, {
            start: parseHM(time),
            end: hasEnd && endTime ? parseHM(endTime) : undefined,
            note,
          });
          onDone();
        }}
        onDelete={async () => {
          await deleteEvent(event.id);
          onDone();
        }}
      />
    </div>
  );
}

export function EncodeSheet({
  sheet,
  onClose,
  suggestBreast,
}: {
  sheet: SheetState;
  onClose: () => void;
  suggestBreast: "G" | "D";
}) {
  return (
    <Sheet open={!!sheet} onClose={onClose}>
      {sheet?.type === "feed" && (
        <FeedForm suggestBreast={suggestBreast} onDone={onClose} />
      )}
      {sheet?.type === "pump" && <PumpForm onDone={onClose} />}
      {sheet?.type === "diaper" && <DiaperForm onDone={onClose} />}
      {sheet?.type === "care" && <CareForm onDone={onClose} />}
      {sheet?.type === "temp" && <TempForm onDone={onClose} />}
      {sheet?.type === "edit" && (
        <EditForm event={sheet.event} onDone={onClose} />
      )}
    </Sheet>
  );
}
