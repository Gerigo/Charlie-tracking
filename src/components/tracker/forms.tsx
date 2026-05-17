import { useState } from "react";
import {
  DateTimeField,
  FieldLabel,
  FormHeader,
  NoteField,
  Segmented,
  Sheet,
  Stepper,
  SubmitBar,
} from "@/components/ui/primitives";
import { IconCaca, IconPipi } from "@/components/ui/icons";
import { TONES, alpha } from "@/lib/theme";
import { pad2 } from "@/lib/dates";
import { withToast } from "@/lib/toast";
import {
  addInstantEvent,
  CARE_OPTIONS,
  deleteEvent,
  updateEvent,
  STOOL_COLORS,
  type AppEvent,
  type CareData,
  type DiaperData,
  type EventData,
  type FeedData,
  type GrowthData,
  type PumpData,
  type TempData,
  type TimeOfDay,
} from "@/lib/events";

export type SheetState =
  | { type: "feed" | "pump" | "diaper" | "care" | "temp" | "growth" }
  | { type: "edit"; event: AppEvent }
  | null;

/** Current time as {h,m} — events are timestamped to "now" by default. */
function nowTOD(): TimeOfDay {
  const d = new Date();
  return { h: d.getHours(), m: d.getMinutes() };
}

const BOTTLE_DAILY_MAX = 160;

function FeedForm({
  suggestBreast,
  bottleMlToday,
  onDone,
}: {
  suggestBreast: "G" | "D";
  bottleMlToday: number;
  onDone: () => void;
}) {
  const [seinOn, setSeinOn] = useState(true);
  const [bibOn, setBibOn] = useState(false);
  const [breast, setBreast] = useState<"G" | "D">(suggestBreast);
  const [ml, setMl] = useState(120);
  const [note, setNote] = useState("");
  const canSave = seinOn || bibOn;
  const toggleStyle = (on: boolean) => ({
    flex: 1,
    padding: "14px 12px",
    borderRadius: 14,
    background: on ? TONES.sand.bg : "var(--p-surface)",
    border: `1px solid ${on ? alpha(TONES.sand.ink, 33) : "var(--hairline)"}`,
    color: on ? TONES.sand.ink : "var(--p-ink)",
    fontWeight: 700,
    fontSize: 14,
  });
  return (
    <div>
      <FormHeader title="Nouvelle tétée" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <FieldLabel>Type · les deux possibles</FieldLabel>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setSeinOn((v) => !v)}
              style={toggleStyle(seinOn)}
            >
              🤱 Sein
            </button>
            <button
              onClick={() => setBibOn((v) => !v)}
              style={toggleStyle(bibOn)}
            >
              🍼 Biberon
            </button>
          </div>
        </div>
        {seinOn && (
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
                    background: breast === b ? TONES.sand.bg : "var(--p-surface)",
                    border: `1px solid ${
                      breast === b ? alpha(TONES.sand.ink, 25) : "var(--hairline)"
                    }`,
                    color: breast === b ? TONES.sand.ink : "var(--p-ink)",
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
        {bibOn &&
          (() => {
            const projected = bottleMlToday + ml;
            const over = projected > BOTTLE_DAILY_MAX;
            return (
              <div>
                <FieldLabel>
                  {seinOn ? "Complément biberon" : "Quantité"}
                </FieldLabel>
                <Stepper
                  value={ml}
                  onChange={setMl}
                  min={10}
                  max={300}
                  step={10}
                  unit=" ml"
                />
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "var(--p-surface)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 12,
                      fontWeight: 700,
                      color: over ? "#9A4F3F" : "rgba(42,38,32,0.65)",
                    }}
                  >
                    <span>Biberon du jour</span>
                    <span className="num">
                      {projected} / {BOTTLE_DAILY_MAX} ml
                    </span>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 8,
                      borderRadius: 999,
                      background: "var(--hairline)",
                      marginTop: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${Math.min(100, (bottleMlToday / BOTTLE_DAILY_MAX) * 100)}%`,
                        background: TONES.sand.ink,
                        opacity: 0.5,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${Math.min(100, (projected / BOTTLE_DAILY_MAX) * 100)}%`,
                        background: over ? "#B5705C" : TONES.sand.ink,
                        transition: "width 180ms ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--p-ink-soft)",
                      marginTop: 8,
                    }}
                  >
                    {bottleMlToday > 0
                      ? `Déjà ${bottleMlToday} ml aujourd'hui · `
                      : ""}
                    {over
                      ? `dépasse le repère conseillé de ${BOTTLE_DAILY_MAX} ml/jour`
                      : `repère conseillé : ${BOTTLE_DAILY_MAX} ml/jour`}
                  </div>
                </div>
              </div>
            );
          })()}
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={() => {
          if (!canSave) return;
          // sein + biberon → tétée avec complément (bottleSupplement) ;
          // biberon seul → biberon ; sein seul → tétée.
          const data: FeedData = seinOn
            ? {
                kind: "sein",
                breast,
                ml: null,
                supp: bibOn ? ml : null,
                note,
              }
            : {
                kind: "biberon",
                breast: null,
                ml,
                supp: null,
                note,
              };
          void withToast(
            () => addInstantEvent("feed", nowTOD(), data, note),
            "Tétée enregistrée",
            onDone,
          );
        }}
      />
    </div>
  );
}

function PumpForm({ onDone }: { onDone: () => void }) {
  const [breast, setBreast] = useState<"G" | "D" | "GD">("G");
  const [ml, setMl] = useState(110);
  const [note, setNote] = useState("");
  return (
    <div>
      <FormHeader title="Tirage de lait" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
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
          <FieldLabel>Note</FieldLabel>
          <NoteField
            value={note}
            onChange={setNote}
            placeholder="Confort, flux, contexte…"
          />
        </div>
      </div>
      <SubmitBar
        onClick={() => {
          const data: PumpData = { breast, ml, note };
          void withToast(
            () => addInstantEvent("pump", nowTOD(), data, note),
            "Tirage enregistré",
            onDone,
          );
        }}
      />
    </div>
  );
}

function DiaperForm({ onDone }: { onDone: () => void }) {
  const [pipi, setPipi] = useState(false);
  const [caca, setCaca] = useState(false);
  const [color, setColor] = useState<string>("jaune_or");
  const [note, setNote] = useState("");
  const pill = (active: boolean) => ({
    flex: 1,
    padding: "16px 12px",
    borderRadius: 14,
    background: active ? TONES.olive.bg : "var(--p-surface)",
    border: `1px solid ${
      active ? alpha(TONES.olive.ink, 25) : "var(--hairline)"
    }`,
    color: active ? TONES.olive.ink : "var(--p-ink)",
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
          gap: 20,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(
              [
                { label: "À surveiller", items: STOOL_COLORS.surveiller },
                { label: "Selles habituelles", items: STOOL_COLORS.habituelles },
                { label: "À signaler", items: STOOL_COLORS.autres },
              ] as const
            ).map((group) => (
              <div key={group.label}>
                <FieldLabel>{group.label}</FieldLabel>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {group.items.map((c) => {
                    const on = color === c.v;
                    return (
                      <button
                        key={c.v}
                        onClick={() => setColor(c.v)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 13px",
                          borderRadius: 999,
                          background: on ? "var(--p-ink)" : "var(--p-surface)",
                          color: on ? "var(--p-surface)" : "var(--p-ink)",
                          border: on
                            ? "1px solid var(--p-ink)"
                            : "1px solid var(--hairline)",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        <span
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: "50%",
                            background: c.sw,
                            border: "1px solid var(--hairline-strong)",
                          }}
                        />
                        {c.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={() => {
          if (!pipi && !caca) return;
          const data: DiaperData = {
            pipi,
            caca,
            color: caca ? color : null,
            note,
          };
          void withToast(
            () => addInstantEvent("diaper", nowTOD(), data, note),
            "Couche enregistrée",
            onDone,
          );
        }}
      />
    </div>
  );
}

function CareForm({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");

  const toggle = (v: string) =>
    setSelected((s) =>
      s.includes(v) ? s.filter((x) => x !== v) : [...s, v],
    );

  const canSave =
    selected.length > 0 &&
    (!selected.includes("custom") || custom.trim().length > 0);

  return (
    <div>
      <FormHeader title="Soins" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <FieldLabel>Type · plusieurs possibles</FieldLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
            }}
          >
            {CARE_OPTIONS.map((o) => {
              const on = selected.includes(o.v);
              return (
                <button
                  key={o.v}
                  onClick={() => toggle(o.v)}
                  style={{
                    position: "relative",
                    padding: "12px 14px",
                    borderRadius: 14,
                    textAlign: "left",
                    background: on ? TONES.sky.bg : "var(--p-surface)",
                    border: `1px solid ${
                      on ? alpha(TONES.sky.ink, 33) : "var(--hairline)"
                    }`,
                    color: on ? TONES.sky.ink : "var(--p-ink)",
                    fontWeight: 600,
                    fontSize: 14,
                    letterSpacing: "-0.005em",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{o.l}</span>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      flexShrink: 0,
                      border: on
                        ? "none"
                        : "1.5px solid var(--hairline-strong)",
                      background: on ? TONES.sky.ink : "transparent",
                      color: TONES.sky.soft,
                      fontSize: 12,
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {selected.includes("custom") && (
          <div>
            <FieldLabel>Détail (autre)</FieldLabel>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="ex: tire-lait, peau à peau…"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--p-surface)",
                fontFamily: "inherit",
                fontSize: 16,
              }}
            />
          </div>
        )}
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        label={
          selected.length > 1
            ? `Enregistrer (${selected.length})`
            : "Enregistrer"
        }
        onClick={() => {
          if (!canSave) return;
          const items = [...selected];
          const data: CareData = {
            kinds: items,
            custom: items.includes("custom") ? custom.trim() : null,
            note,
          };
          // A single event groups all selected soins → one entry in
          // "Aujourd'hui", not N.
          void withToast(
            () => addInstantEvent("care", nowTOD(), data, note),
            items.length > 1 ? "Soins enregistrés" : "Soin enregistré",
            onDone,
          );
        }}
      />
    </div>
  );
}

function TempForm({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState(36.8);
  const [slot, setSlot] = useState<"matin" | "soir">("matin");
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
          gap: 20,
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
                background: "var(--p-surface)",
                boxShadow: "0 1px 3px var(--hairline)",
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
                color: value > 38 ? "#9A4F3F" : "var(--p-ink)",
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
                background: "var(--p-surface)",
                boxShadow: "0 1px 3px var(--hairline)",
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
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={() => {
          const data: TempData = { value, slot, note };
          void withToast(
            () => addInstantEvent("temp", nowTOD(), data, note),
            "Température enregistrée",
            onDone,
          );
        }}
      />
    </div>
  );
}

const EDIT_LABELS: Record<AppEvent["type"], string> = {
  sleep: "Sommeil",
  feed: "Tétée",
  pump: "Tirage",
  diaper: "Couche",
  care: "Soins",
  temp: "Température",
  growth: "Mesure",
};

function EditForm({
  event,
  onDone,
}: {
  event: AppEvent;
  onDone: () => void;
}) {
  const t = event.type;
  const inProgress = t === "sleep" && event.end == null;
  const fd = event.data as unknown as Record<string, unknown>;
  const str = (k: string) =>
    typeof fd[k] === "string" ? (fd[k] as string) : undefined;
  const num = (k: string, d: number) =>
    typeof fd[k] === "number" ? (fd[k] as number) : d;
  const dtLocal = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
      d.getHours(),
    )}:${pad2(d.getMinutes())}`;

  const [time, setTime] = useState(dtLocal(event.start));
  const [endTime, setEndTime] = useState(
    dtLocal(event.end ?? event.start),
  );
  const [note, setNote] = useState(event.data.note ?? "");
  // feed
  const [fKind, setFKind] = useState<"sein" | "biberon">(
    str("kind") === "biberon" ? "biberon" : "sein",
  );
  const [fBreast, setFBreast] = useState<"G" | "D">(
    str("breast") === "D" ? "D" : "G",
  );
  const [fMl, setFMl] = useState(num("ml", 120));
  const [fSupp, setFSupp] = useState(num("supp", 0));
  // pump
  const [pSide, setPSide] = useState<"G" | "D" | "GD">(
    str("breast") === "GD" ? "GD" : str("breast") === "D" ? "D" : "G",
  );
  const [pMl, setPMl] = useState(num("ml", 110));
  // diaper
  const [pipi, setPipi] = useState(fd.pipi === true);
  const [caca, setCaca] = useState(fd.caca === true);
  const [color, setColor] = useState<string>(str("color") ?? "jaune_or");
  // care
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(fd.kinds) ? (fd.kinds as string[]) : [],
  );
  const [custom, setCustom] = useState(str("custom") ?? "");
  // temp
  const [tVal, setTVal] = useState(num("value", 36.8));
  const [tSlot, setTSlot] = useState<"matin" | "soir">(
    str("slot") === "soir" ? "soir" : "matin",
  );
  // growth
  const [gW, setGW] = useState(num("weight", 4.5));
  const [gH, setGH] = useState(num("height", 56));
  const [gHead, setGHead] = useState(num("head", 38));

  const toggle = (v: string) =>
    setSelected((s) =>
      s.includes(v) ? s.filter((x) => x !== v) : [...s, v],
    );

  const buildData = (): EventData => {
    switch (t) {
      case "feed":
        return {
          kind: fKind,
          breast: fKind === "sein" ? fBreast : null,
          ml: fKind === "biberon" ? fMl : null,
          supp: fKind === "sein" && fSupp > 0 ? fSupp : null,
          note,
        };
      case "pump":
        return { breast: pSide, ml: pMl, note };
      case "diaper":
        return { pipi, caca, color: caca ? color : null, note };
      case "care":
        return {
          kinds: selected.length ? selected : ["custom"],
          custom: selected.includes("custom") ? custom.trim() : null,
          note,
        };
      case "temp":
        return { value: tVal, slot: tSlot, note };
      case "growth":
        return { weight: gW, height: gH, head: gHead, note };
      default:
        return { note };
    }
  };

  const optBtn = (active: boolean, tone = TONES.sky) => ({
    padding: "12px 14px",
    borderRadius: 14,
    textAlign: "left" as const,
    background: active ? tone.bg : "var(--p-surface)",
    border: `1px solid ${active ? alpha(tone.ink, 33) : "var(--hairline)"}`,
    color: active ? tone.ink : "var(--p-ink)",
    fontWeight: 600,
    fontSize: 14,
  });

  return (
    <div>
      <FormHeader title={`Modifier · ${EDIT_LABELS[t]}`} />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <FieldLabel>{t === "sleep" ? "Début" : "Date et heure"}</FieldLabel>
          <DateTimeField value={time} onChange={setTime} />
        </div>
        {t === "sleep" && inProgress && (
          <div
            style={{
              fontSize: 12,
              color: "rgba(42,38,32,0.6)",
              fontStyle: "italic",
            }}
          >
            Sommeil en cours — modifie juste l'heure de début, il
            continue de tourner.
          </div>
        )}
        {t === "sleep" && !inProgress && (
          <div>
            <FieldLabel>Fin</FieldLabel>
            <DateTimeField value={endTime} onChange={setEndTime} />
          </div>
        )}

        {t === "feed" && (
          <>
            <div>
              <FieldLabel>Type</FieldLabel>
              <Segmented
                value={fKind}
                onChange={setFKind}
                options={[
                  { value: "sein", label: "Sein" },
                  { value: "biberon", label: "Biberon" },
                ]}
              />
            </div>
            {fKind === "sein" ? (
              <>
                <div>
                  <FieldLabel>Sein</FieldLabel>
                  <Segmented
                    value={fBreast}
                    onChange={setFBreast}
                    options={[
                      { value: "G", label: "Gauche" },
                      { value: "D", label: "Droit" },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Complément biberon (optionnel)</FieldLabel>
                  <Stepper
                    value={fSupp}
                    onChange={setFSupp}
                    min={0}
                    max={200}
                    step={10}
                    unit=" ml"
                  />
                </div>
              </>
            ) : (
              <div>
                <FieldLabel>Quantité</FieldLabel>
                <Stepper
                  value={fMl}
                  onChange={setFMl}
                  min={10}
                  max={300}
                  step={10}
                  unit=" ml"
                />
              </div>
            )}
          </>
        )}

        {t === "pump" && (
          <>
            <div>
              <FieldLabel>Sein</FieldLabel>
              <Segmented
                value={pSide}
                onChange={setPSide}
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
                value={pMl}
                onChange={setPMl}
                min={5}
                max={400}
                step={5}
                unit=" ml"
              />
            </div>
          </>
        )}

        {t === "diaper" && (
          <>
            <div>
              <FieldLabel>Contenu</FieldLabel>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setPipi(!pipi)}
                  style={{
                    flex: 1,
                    padding: "16px 12px",
                    borderRadius: 14,
                    background: pipi ? TONES.olive.bg : "var(--p-surface)",
                    border: `1px solid ${
                      pipi ? alpha(TONES.olive.ink, 33) : "var(--hairline)"
                    }`,
                    color: pipi ? TONES.olive.ink : "var(--p-ink)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "center",
                  }}
                >
                  <IconPipi size={18} /> Pipi
                </button>
                <button
                  onClick={() => setCaca(!caca)}
                  style={{
                    flex: 1,
                    padding: "16px 12px",
                    borderRadius: 14,
                    background: caca ? TONES.olive.bg : "var(--p-surface)",
                    border: `1px solid ${
                      caca ? alpha(TONES.olive.ink, 33) : "var(--hairline)"
                    }`,
                    color: caca ? TONES.olive.ink : "var(--p-ink)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    justifyContent: "center",
                  }}
                >
                  <IconCaca size={18} /> Caca
                </button>
              </div>
            </div>
            {caca && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                {(
                  [
                    { label: "À surveiller", items: STOOL_COLORS.surveiller },
                    {
                      label: "Selles habituelles",
                      items: STOOL_COLORS.habituelles,
                    },
                    { label: "À signaler", items: STOOL_COLORS.autres },
                  ] as const
                ).map((g) => (
                  <div key={g.label}>
                    <FieldLabel>{g.label}</FieldLabel>
                    <div
                      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
                      {g.items.map((c) => {
                        const on = color === c.v;
                        return (
                          <button
                            key={c.v}
                            onClick={() => setColor(c.v)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "9px 13px",
                              borderRadius: 999,
                              background: on ? "var(--p-ink)" : "var(--p-surface)",
                              color: on ? "var(--p-surface)" : "var(--p-ink)",
                              border: on
                                ? "1px solid var(--p-ink)"
                                : "1px solid var(--hairline)",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                width: 15,
                                height: 15,
                                borderRadius: "50%",
                                background: c.sw,
                                border: "1px solid var(--hairline-strong)",
                              }}
                            />
                            {c.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {t === "care" && (
          <>
            <div>
              <FieldLabel>Type · plusieurs possibles</FieldLabel>
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
                    onClick={() => toggle(o.v)}
                    style={optBtn(selected.includes(o.v))}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            {selected.includes("custom") && (
              <div>
                <FieldLabel>Détail (autre)</FieldLabel>
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="ex: tire-lait, peau à peau…"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--hairline)",
                    background: "var(--p-surface)",
                    fontFamily: "inherit",
                    fontSize: 16,
                  }}
                />
              </div>
            )}
          </>
        )}

        {t === "temp" && (
          <>
            <div>
              <FieldLabel>Moment</FieldLabel>
              <Segmented
                value={tSlot}
                onChange={setTSlot}
                options={[
                  { value: "matin", label: "Matin" },
                  { value: "soir", label: "Soir" },
                ]}
              />
            </div>
            <div>
              <FieldLabel>Mesure</FieldLabel>
              <div
                style={{ display: "flex", alignItems: "center", gap: 14 }}
              >
                <button
                  onClick={() => setTVal(+(tVal - 0.1).toFixed(1))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: "var(--p-surface)",
                    boxShadow: "0 1px 3px var(--hairline)",
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
                    color: tVal > 38 ? "#9A4F3F" : "var(--p-ink)",
                  }}
                >
                  {tVal.toFixed(1)}°
                </div>
                <button
                  onClick={() => setTVal(+(tVal + 0.1).toFixed(1))}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: "var(--p-surface)",
                    boxShadow: "0 1px 3px var(--hairline)",
                    fontSize: 22,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}

        {t === "growth" && (
          <>
            {(
              [
                { l: "Poids", v: gW, set: setGW, st: 0.05, mn: 1, mx: 20, u: "kg", d: 2 },
                { l: "Taille", v: gH, set: setGH, st: 0.5, mn: 30, mx: 120, u: "cm", d: 1 },
                { l: "Périmètre crânien", v: gHead, set: setGHead, st: 0.1, mn: 25, mx: 60, u: "cm", d: 1 },
              ] as const
            ).map((f) => (
              <div
                key={f.l}
                style={{
                  padding: 14,
                  background: "var(--p-surface)",
                  borderRadius: 14,
                  border: "1px solid var(--hairline)",
                }}
              >
                <FieldLabel>{f.l}</FieldLabel>
                <div
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <button
                    onClick={() =>
                      f.set(Math.max(f.mn, +(f.v - f.st).toFixed(2)))
                    }
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: "var(--hairline)",
                      fontSize: 20,
                    }}
                  >
                    −
                  </button>
                  <div
                    className="num serif"
                    style={{ flex: 1, textAlign: "center", fontSize: 34 }}
                  >
                    {f.v.toFixed(f.d)}
                    <span
                      style={{ fontSize: 15, opacity: 0.5, marginLeft: 4 }}
                    >
                      {f.u}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      f.set(Math.min(f.mx, +(f.v + f.st).toFixed(2)))
                    }
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: "var(--hairline)",
                      fontSize: 20,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} placeholder="Optionnel…" />
        </div>
      </div>
      <SubmitBar
        onClick={() => {
          // datetime-local "YYYY-MM-DDTHH:MM" → epoch ms (local)
          const mk = (s: string) => {
            const m = s.match(
              /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
            );
            if (!m) return event.start.getTime();
            return new Date(
              +m[1],
              +m[2] - 1,
              +m[3],
              +m[4],
              +m[5],
              0,
              0,
            ).getTime();
          };
          const startMs = mk(time);
          let endMs: number | null;
          if (inProgress) {
            endMs = null; // sommeil en cours : il continue
          } else if (t === "sleep") {
            endMs = mk(endTime);
            if (endMs <= startMs) endMs = startMs + 60000; // pad like main
          } else {
            endMs = startMs;
          }
          void withToast(
            () =>
              updateEvent(event.id, {
                startMs,
                endMs,
                type: t,
                data: buildData() as never,
                note,
              }),
            "Événement modifié",
            onDone,
          );
        }}
        onDelete={() => {
          void withToast(
            () => deleteEvent(event.id),
            "Événement supprimé",
            onDone,
          );
        }}
      />
    </div>
  );
}

function GrowthForm({
  initial,
  onDone,
}: {
  initial?: { weight: number; height: number; head: number };
  onDone: () => void;
}) {
  const [weight, setWeight] = useState(initial?.weight ?? 4.5);
  const [height, setHeight] = useState(initial?.height ?? 56);
  const [head, setHead] = useState(initial?.head ?? 38);
  const [note, setNote] = useState("");
  const fields = [
    {
      key: "w",
      label: "Poids",
      v: weight,
      set: setWeight,
      step: 0.05,
      min: 1,
      max: 20,
      unit: "kg",
      dec: 2,
    },
    {
      key: "h",
      label: "Taille",
      v: height,
      set: setHeight,
      step: 0.5,
      min: 30,
      max: 120,
      unit: "cm",
      dec: 1,
    },
    {
      key: "p",
      label: "Périmètre crânien",
      v: head,
      set: setHead,
      step: 0.1,
      min: 25,
      max: 60,
      unit: "cm",
      dec: 1,
    },
  ];
  return (
    <div>
      <FormHeader title="Nouvelle mesure" />
      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {fields.map((f) => (
          <div
            key={f.key}
            style={{
              padding: 14,
              background: "var(--p-surface)",
              borderRadius: 14,
              border: "1px solid var(--hairline)",
            }}
          >
            <FieldLabel>{f.label}</FieldLabel>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() =>
                  f.set(Math.max(f.min, +(f.v - f.step).toFixed(2)))
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "var(--hairline)",
                  fontSize: 20,
                }}
              >
                −
              </button>
              <div
                className="num serif"
                style={{ flex: 1, textAlign: "center", fontSize: 34 }}
              >
                {f.v.toFixed(f.dec)}
                <span style={{ fontSize: 15, opacity: 0.5, marginLeft: 4 }}>
                  {f.unit}
                </span>
              </div>
              <button
                onClick={() =>
                  f.set(Math.min(f.max, +(f.v + f.step).toFixed(2)))
                }
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "var(--hairline)",
                  fontSize: 20,
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
        <div>
          <FieldLabel>Note</FieldLabel>
          <NoteField value={note} onChange={setNote} />
        </div>
      </div>
      <SubmitBar
        onClick={() => {
          const data: GrowthData = {
            weight,
            height,
            head,
            note,
          };
          const now = new Date();
          void withToast(
            () =>
              addInstantEvent(
                "growth",
                { h: now.getHours(), m: now.getMinutes() },
                data,
                note,
              ),
            "Mesure enregistrée",
            onDone,
          );
        }}
      />
    </div>
  );
}

export function EncodeSheet({
  sheet,
  onClose,
  suggestBreast,
  bottleMlToday,
  growthInitial,
}: {
  sheet: SheetState;
  onClose: () => void;
  suggestBreast: "G" | "D";
  bottleMlToday: number;
  growthInitial?: { weight: number; height: number; head: number };
}) {
  return (
    <Sheet open={!!sheet} onClose={onClose}>
      {sheet?.type === "feed" && (
        <FeedForm
          suggestBreast={suggestBreast}
          bottleMlToday={bottleMlToday}
          onDone={onClose}
        />
      )}
      {sheet?.type === "pump" && <PumpForm onDone={onClose} />}
      {sheet?.type === "diaper" && <DiaperForm onDone={onClose} />}
      {sheet?.type === "care" && <CareForm onDone={onClose} />}
      {sheet?.type === "temp" && <TempForm onDone={onClose} />}
      {sheet?.type === "growth" && (
        <GrowthForm initial={growthInitial} onDone={onClose} />
      )}
      {sheet?.type === "edit" && (
        <EditForm event={sheet.event} onDone={onClose} />
      )}
    </Sheet>
  );
}
