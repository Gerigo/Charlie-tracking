import { useMemo, useState } from "react";
import { PALETTES, TONES } from "@/lib/theme";
import { fmtDateFull, timeAgo } from "@/lib/dates";
import { type AppEvent, type MealData } from "@/lib/events";
import { useEvents } from "@/lib/eventsContext";
import {
  FOOD_CATALOG,
  OBSERVATION_MS,
  amountLabel,
  foodStatsFor,
  mealText,
  reactionEmoji,
  type FoodStat,
} from "@/lib/food";
import { Sheet } from "@/components/ui/primitives";

const P = PALETTES.sage;
const G = TONES.garden;

/** Statut d'un aliment déduit de son historique. */
function statusOf(s: FoodStat): { label: string; bg: string; ink: string } {
  if (s.everFlagged)
    return {
      label: "À surveiller",
      bg: "var(--delta-neg-bg)",
      ink: "var(--delta-neg-ink)",
    };
  if (s.times >= 3)
    return {
      label: "Bien toléré",
      bg: "var(--delta-pos-bg)",
      ink: "var(--delta-pos-ink)",
    };
  return { label: "Introduit", bg: "var(--hairline)", ink: P.inkSoft };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: P.inkSoft,
        opacity: 0.7,
        margin: "22px 4px 10px",
      }}
    >
      {children}
    </div>
  );
}

function FoodChip({
  emoji,
  label,
  sub,
  allergen,
  onClick,
}: {
  emoji: string;
  label: string;
  sub?: string;
  allergen?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 13px",
        borderRadius: 14,
        background: "var(--p-surface)",
        border: "1px solid var(--hairline)",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{ display: "block", fontSize: 14, fontWeight: 700, color: P.ink }}
        >
          {label}
          {allergen && <span style={{ marginLeft: 5 }}>⚠️</span>}
        </span>
        {sub && (
          <span style={{ fontSize: 11.5, color: P.inkSoft }}>{sub}</span>
        )}
      </span>
    </button>
  );
}

export function FoodJournal() {
  const { events } = useEvents();
  const [selected, setSelected] = useState<FoodStat | null>(null);

  const M = useMemo(() => {
    const stats = foodStatsFor(events);
    const now = Date.now();
    const byRecent = [...stats].sort(
      (a, b) => b.lastTried.getTime() - a.lastTried.getTime(),
    );
    const observing = stats
      .filter((s) => now - s.firstTried.getTime() < OBSERVATION_MS)
      .sort((a, b) => b.firstTried.getTime() - a.firstTried.getTime());

    const introducedCatalogIds = new Set(
      stats.filter((s) => !s.id.startsWith("custom:")).map((s) => s.id),
    );
    const allergens = FOOD_CATALOG.filter((f) => f.allergen);
    const allergensDone = allergens.filter((f) =>
      introducedCatalogIds.has(f.v),
    ).length;

    const toTry = FOOD_CATALOG.filter(
      (f) => !f.allergen && !introducedCatalogIds.has(f.v),
    );

    // Repas avec réaction signalée, plus récent en premier.
    const reactions = events
      .filter((e) => e.type === "meal" && (e.data as MealData).allergy)
      .sort((a, b) => b.start.getTime() - a.start.getTime());

    return {
      count: stats.length,
      byRecent,
      observing,
      allergens,
      allergensDone,
      introducedCatalogIds,
      toTry,
      reactions,
    };
  }, [events]);

  // Historique d'un aliment sélectionné (tous les repas qui le contiennent).
  const history = useMemo(() => {
    if (!selected) return [];
    return events
      .filter((e) => {
        if (e.type !== "meal") return false;
        const d = e.data as MealData;
        if (selected.id.startsWith("custom:")) {
          return (
            d.foods.includes("custom") &&
            `custom:${(d.custom ?? "").trim().toLowerCase()}` === selected.id
          );
        }
        return d.foods.includes(selected.id);
      })
      .sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [selected, events]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: P.bg,
      }}
    >
      <div style={{ padding: "22px 22px 8px" }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: P.inkSoft,
            opacity: 0.7,
          }}
        >
          Aliments
        </div>
        <div
          className="serif"
          style={{ fontSize: 30, lineHeight: 1.05, color: P.ink, marginTop: 2 }}
        >
          {M.count > 0
            ? `${M.count} aliment${M.count > 1 ? "s" : ""} découvert${
                M.count > 1 ? "s" : ""
              } 🎉`
            : "Journal des aliments"}
        </div>
      </div>

      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px calc(120px + env(safe-area-inset-bottom))",
        }}
      >
        {M.count === 0 && M.reactions.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              color: P.inkSoft,
              fontSize: 13,
              background: P.surface,
              borderRadius: 18,
              border: `0.5px solid ${P.line}`,
              marginTop: 12,
            }}
          >
            Aucun aliment encodé pour l'instant. Ajoute un repas depuis le
            Tracker (tuile « Repas 🥄 ») et il apparaîtra ici.
          </div>
        ) : null}

        {/* En observation (règle des 3 jours) */}
        {M.observing.length > 0 && (
          <>
            <SectionTitle>🔍 En observation · 3 jours</SectionTitle>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                background: G.soft,
                border: `0.5px solid ${G.bg}`,
              }}
            >
              <div
                style={{ fontSize: 12, color: G.ink, marginBottom: 10, opacity: 0.85 }}
              >
                Introduits récemment — surveille une éventuelle réaction avant
                d'enchaîner un nouvel aliment.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {M.observing.map((s) => {
                  const daysLeft = Math.max(
                    1,
                    Math.ceil(
                      (OBSERVATION_MS - (Date.now() - s.firstTried.getTime())) /
                        86400000,
                    ),
                  );
                  return (
                    <FoodChip
                      key={s.id}
                      emoji={s.emoji}
                      label={s.label}
                      allergen={s.allergen}
                      sub={`Depuis ${timeAgo(s.firstTried)} · encore ${daysLeft} j`}
                      onClick={() => setSelected(s)}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Réactions signalées */}
        {M.reactions.length > 0 && (
          <>
            <SectionTitle>🚩 Réactions signalées</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {M.reactions.map((e) => {
                const d = e.data as MealData;
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: "var(--delta-neg-bg)",
                      border: "1px solid var(--delta-neg-ink)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: "var(--delta-neg-ink)",
                      }}
                    >
                      {mealText(d)}
                    </div>
                    <div
                      style={{ fontSize: 11.5, color: P.inkSoft, marginTop: 3 }}
                    >
                      {fmtDateFull(e.start)}
                      {d.symptoms.length ? ` · ${d.symptoms.join(", ")}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Allergènes majeurs */}
        <SectionTitle>⚠️ Allergènes majeurs</SectionTitle>
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 16,
            background: P.surface,
            border: `0.5px solid ${P.line}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              fontSize: 12,
              fontWeight: 700,
              color: P.inkSoft,
            }}
          >
            <span>Introduits</span>
            <span className="num">
              {M.allergensDone} / {M.allergens.length}
            </span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--hairline)",
              marginTop: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(M.allergensDone / M.allergens.length) * 100}%`,
                background: G.ink,
                transition: "width 200ms ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            {M.allergens.map((f) => {
              const done = M.introducedCatalogIds.has(f.v);
              return (
                <span
                  key={f.v}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 11px",
                    borderRadius: 999,
                    background: done ? "var(--delta-pos-bg)" : "var(--p-surface)",
                    border: `1px solid ${
                      done ? "var(--delta-pos-ink)" : "var(--hairline)"
                    }`,
                    color: done ? "var(--delta-pos-ink)" : P.inkSoft,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <span>{f.emoji}</span>
                  {f.l}
                  <span style={{ fontWeight: 800 }}>{done ? "✓" : ""}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Déjà introduits */}
        {M.byRecent.length > 0 && (
          <>
            <SectionTitle>🍽️ Déjà introduits</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {M.byRecent.map((s) => {
                const st = statusOf(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 13px",
                      borderRadius: 14,
                      background: "var(--p-surface)",
                      border: "1px solid var(--hairline)",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{s.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 14,
                          fontWeight: 700,
                          color: P.ink,
                        }}
                      >
                        {s.label}
                        {s.allergen && <span style={{ marginLeft: 5 }}>⚠️</span>}
                      </span>
                      <span style={{ fontSize: 11.5, color: P.inkSoft }}>
                        Donné {s.times}× · dernier {timeAgo(s.lastTried)}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: st.bg,
                        color: st.ink,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* À essayer */}
        {M.toTry.length > 0 && (
          <>
            <SectionTitle>💡 À essayer</SectionTitle>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {M.toTry.map((f) => (
                <span
                  key={f.v}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: P.surface,
                    border: `1px solid ${P.line}`,
                    color: P.inkSoft,
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <span>{f.emoji}</span>
                  {f.l}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Fiche détail d'un aliment */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div style={{ padding: "6px 24px 28px" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <span style={{ fontSize: 34 }}>{selected.emoji}</span>
              <div>
                <div className="serif" style={{ fontSize: 27, lineHeight: 1.1 }}>
                  {selected.label}
                  {selected.allergen && (
                    <span style={{ marginLeft: 6, fontSize: 20 }}>⚠️</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: P.inkSoft, marginTop: 2 }}>
                  Donné {selected.times}× · 1ʳᵉ fois le{" "}
                  {fmtDateFull(selected.firstTried)}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: P.inkSoft,
                margin: "20px 0 10px",
              }}
            >
              Historique
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((e: AppEvent) => {
                const d = e.data as MealData;
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: "10px 13px",
                      borderRadius: 12,
                      background: d.allergy
                        ? "var(--delta-neg-bg)"
                        : "var(--p-soft)",
                      border: `1px solid ${
                        d.allergy ? "var(--delta-neg-ink)" : "var(--hairline)"
                      }`,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
                      {fmtDateFull(e.start)} · {amountLabel(d.amount)}{" "}
                      {reactionEmoji(d.reaction)}
                      {d.allergy && " ⚠️"}
                    </div>
                    {d.note?.trim() && (
                      <div
                        style={{
                          fontSize: 12,
                          fontStyle: "italic",
                          color: P.inkSoft,
                          marginTop: 3,
                        }}
                      >
                        « {d.note.trim()} »
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
