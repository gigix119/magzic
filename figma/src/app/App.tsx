import { useState, useRef } from "react";
import {
  Star, Clock, Search, Plus, Bell, HelpCircle, ChevronDown, ChevronRight,
  LayoutGrid, Users, Settings, Home, FileText, X, Menu,
  Pencil, Paperclip, AlignLeft, Calendar, Zap, Filter,
  PlugZap, Share2, MoreHorizontal, ChevronsLeftRight,
  Inbox, CalendarDays, Layers, Shuffle, Printer, Archive,
  Tag, Activity, Copy, EyeOff, ChevronLeft,
} from "lucide-react";

// ─── Token map (1:1 tablicaTokens.js) ────────────────────────────────────────
// bg/deep            #0A1A2F        bg/mid       #13314F    bg/surface   #1E4D6B
// sidebar/bg         #080F1A
// akcent/baltic      #37A0C9
// text/main          #F4F8FB        text/meta    #A9BBC9
// board/teal         #1A8B99        board/amber  #B87333    board/navy   #1C3456
// lista/bg           rgba(0,0,0,0.30)
// karta/bg           #22272B        karta/hover  #2E3640
// karta/dragging bg  rgba(255,255,255,0.08)
// nagłówek/teal      #0FA3B1   nagłówek/violet  #5B4A9E
// nagłówek/amber     #C47A1E   nagłówek/green   #1F7A5C
// nagłówek/red       #8B2E2E   nagłówek/navy    #2B4A6F
// label/green  #1F7A5C  label/orange #C47A1E  label/violet #5B4A9E  label/red #8B2E2E
// radius/lista 12   radius/karta 8   radius/modal 16

// ─── Types ────────────────────────────────────────────────────────────────────
type AppScreen = "grid" | "interior-teal" | "interior-colored" | "card-variants";

interface CardLabel { color: string; text?: string }
interface KartaData {
  id: string;
  title: string;
  labels?: CardLabel[];
  coverPhoto?: string;
  attachments?: number;
  hasDescription?: boolean;
  deadline?: string;
  isOverdue?: boolean;
}
interface ListaData {
  id: string;
  title: string;
  cards: KartaData[];
  headerColor?: string; // nagłówek/variant color
}
interface BoardData {
  id: string;
  name: string;
  cover: { type: "color"; value: string } | { type: "photo"; url: string };
  starred: boolean;
  lastVisited?: string;
}

// ─── Mock boards ──────────────────────────────────────────────────────────────
const BOARDS: BoardData[] = [
  { id: "b1", name: "Tablica Półwysep (Jas+Jur+Hel)", cover: { type: "color", value: "#0FA3B1" }, starred: true },
  { id: "b2", name: "Tablica Mechelinki", cover: { type: "color", value: "#D9912E" }, starred: true },
  { id: "b3", name: "Tablica Zagranica (Wł+Puck)", cover: { type: "color", value: "#B5483C" }, starred: false, lastVisited: "2 godz. temu" },
  { id: "b4", name: "Techniczne Zagranica (Wł+Puck)", cover: { type: "color", value: "#2B4A6F" }, starred: false, lastVisited: "wczoraj" },
  { id: "b5", name: "LIDO", cover: { type: "photo", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80" }, starred: false, lastVisited: "3 dni temu" },
  { id: "b6", name: "SERWIS", cover: { type: "color", value: "#1F7A5C" }, starred: false },
  { id: "b7", name: "Techniczne Mechelinki", cover: { type: "color", value: "#5B4A9E" }, starred: false },
  { id: "b8", name: "Techniczne lista Główna", cover: { type: "color", value: "#6B6E72" }, starred: false },
];

// ─── Mock B-01: Tablica Zagranica (teal bg, simple text cards) ────────────────
const LISTA_TEAL: ListaData[] = [
  {
    id: "l1", title: "BRELOK BRAK",
    cards: [
      { id: "k1",  title: "Klif C2!" },
      { id: "k2",  title: "Nexo H11 - 24.06" },
      { id: "k3",  title: "nx e18 brak karty" },
      { id: "k4",  title: "Nexo D24 - 24.06" },
      { id: "k5",  title: "Klif A3" },
      { id: "k6",  title: "Nexo G3", attachments: 1 },
      { id: "k7",  title: "Kat 7 Dolozyc 2x poszewka oraz wode" },
      { id: "k8",  title: "NEXO G3 KAPA I POSZEWKI NOWE NIE NASZ LOKAL" },
      { id: "k9",  title: "Klif B1 - sprawdzić zamek" },
      { id: "k10", title: "nx e4 - klucz zapasowy" },
      { id: "k11", title: "Klif D5!" },
      { id: "k12", title: "Nexo F2 brak pilota bramy" },
      { id: "k13", title: "nx c9 - nowy brelok zamówiony" },
      { id: "k14", title: "Klif A7 sprawdzić" },
    ],
  },
  {
    id: "l2", title: ".",
    cards: [],
  },
  {
    id: "l3", title: "24.06 IGOR potwierdzone",
    cards: [
      { id: "k15", title: "Nexo E11 - zmiana" },
      { id: "k16", title: "Klif C4 - przyjazd 16:00", labels: [{ color: "#1F7A5C" }] },
      { id: "k17", title: "Nexo A3 - wyjazd" },
      { id: "k18", title: "Klif B2" },
      { id: "k19", title: "nx D1 - sprawdź ekspres" },
    ],
  },
  {
    id: "l4", title: "24.06 gotowe",
    cards: [
      { id: "k20", title: "Klif A1 ✓", labels: [{ color: "#1F7A5C" }] },
      { id: "k21", title: "Nexo C7 gotowe" },
      { id: "k22", title: "Klif D3" },
      { id: "k23", title: "nx B8 - zmiana pościel", hasDescription: true, attachments: 2 },
      { id: "k24", title: "Klif E2" },
      { id: "k25", title: "Nexo H4 ✓" },
    ],
  },
  {
    id: "l5", title: "24.06 Becia Z, Daria granatowy ford",
    cards: [
      { id: "k26", title: "Klif C3 - Becia" },
      { id: "k27", title: "Nexo G9 - Daria" },
      { id: "k28", title: "Klif B5" },
    ],
  },
  {
    id: "l6", title: "dołożyć braki",
    cards: [
      { id: "k29", title: "ręczniki 4x Nexo" },
      { id: "k30", title: "pościel 2x Klif B1" },
      { id: "k31", title: "kawa + herbata uzupełnić", labels: [{ color: "#C47A1E" }] },
      { id: "k32", title: "mydło płynne — cały Klif" },
    ],
  },
];

// ─── Mock B-02: Techniczne Zagranica (colored headers, CAPS text) ──────────────
const LISTA_COLORED: ListaData[] = [
  {
    id: "lc1", title: "Pęknięcia", headerColor: "#0FA3B1",
    cards: [
      { id: "c1", title: "NEXO E11 - PĘKNIĘCIE PŁYTKI W ŁAZIENCE. ZDJĘCIE W ZAŁĄCZNIKU.", attachments: 3 },
      { id: "c2", title: "KLIF C2 - PĘKNIĘTA SZYBA W DRZWIACH BALKONOWYCH" },
      { id: "c3", title: "NEXO H3 - SPĘKANA FUGA PRZY WANNIE", labels: [{ color: "#8B2E2E", text: "pilne" }] },
      { id: "c4", title: "KLIF B7 - PĘKNIĘCIA PRZY OKNIE PO LEWEJ" },
      { id: "c5", title: "NEXO A1 - ZARYSOWANIE PODŁOGI ≥10cm", hasDescription: true },
    ],
  },
  {
    id: "lc2", title: "gnieżdżewo", headerColor: "#5B4A9E",
    cards: [
      { id: "c6",  title: "GNIAZDKO 230V KLIF D3 - NIE DZIAŁA GNIAZDKO PRZY ŁÓŻKU" },
      { id: "c7",  title: "NEXO G8 - BRAK PRĄDU W SALONIE (BEZPIECZNIK?)" },
      { id: "c8",  title: "KLIF A5 - GNIAZDKO USB USZKODZONE W SYPIALNI", labels: [{ color: "#5B4A9E" }, { color: "#1F7A5C" }] },
    ],
  },
  {
    id: "lc3", title: "LISTA DO ZROBIENIA POINFORMOWANA LAURA", headerColor: "#C47A1E",
    cards: [
      { id: "c9",  title: "NEXO C4 - WYMIANA ŻARÓWKI W ŁAZIENCE (E27 9W)" },
      { id: "c10", title: "KLIF E1 - NAPRAWA ROLETY BALKONOWEJ - LAURA ZAMÓWIŁA CZĘŚĆ" },
      { id: "c11", title: "NEXO B2 - WYMIANA BATERII W PILOCIE KLIMATYZACJI" },
      { id: "c12", title: "KLIF D1 - USZCZELKA PRZY OKNIE SYPIALNIANYM" },
      { id: "c13", title: "NEXO F5 - NAPRAWA KLAMKI DO ŁAZIENKI", labels: [{ color: "#C47A1E", text: "oczekuje" }] },
      { id: "c14", title: "KLIF C5 - WANNA: ODPŁYW ZATKANY" },
      { id: "c15", title: "NEXO A6 - DRZWI WEJŚCIOWE - SPRAWDZIĆ ZAMEK" },
      { id: "c16", title: "KLIF B3 - CIEKNĄCY KRAN W KUCHNI - ZAWÓR", hasDescription: true, attachments: 1, deadline: "25.06" },
    ],
  },
  {
    id: "lc4", title: "zrobione", headerColor: "#1F7A5C",
    cards: [
      { id: "c17", title: "NEXO D2 - WYMIANA PRALKI ✓" },
      { id: "c18", title: "KLIF A2 - NAPRAWA BOJLERA ✓", labels: [{ color: "#1F7A5C" }] },
      { id: "c19", title: "NEXO H1 - MALOWANIE ŚCIANY W SALONIE ✓" },
      { id: "c20", title: "KLIF C1 - MONTAŻ NOWEGO TELEWIZORA ✓" },
    ],
  },
];

// ─── KartaTablicy ─────────────────────────────────────────────────────────────
function KartaTablicy({
  karta,
  variant = "simple",
  state = "default",
}: {
  karta: KartaData;
  variant?: "simple" | "enriched";
  state?: "default" | "hover" | "dragging";
}) {
  const [hovered, setHovered] = useState(state === "hover");

  const bgColor = state === "dragging"
    ? "rgba(255,255,255,0.08)"
    : hovered
    ? "#2E3640"
    : "#22272B";

  const isEnriched = variant === "enriched" || karta.labels?.length || karta.coverPhoto || karta.attachments || karta.hasDescription || karta.deadline;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(state === "hover")}
      style={{
        background: bgColor,
        borderRadius: 8,
        cursor: state === "dragging" ? "grabbing" : "pointer",
        transform: state === "dragging" ? "rotate(2deg) scale(1.02)" : hovered ? "translateY(-1px)" : "none",
        boxShadow: state === "dragging"
          ? "0 12px 32px rgba(0,0,0,0.55)"
          : hovered
          ? "0 4px 12px rgba(0,0,0,0.40)"
          : "0 1px 4px rgba(0,0,0,0.25)",
        transition: "background 0.12s, transform 0.12s, box-shadow 0.12s",
        position: "relative",
        overflow: "hidden",
        border: state === "dragging" ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
      }}
    >
      {/* Cover photo (enriched, conditional: gdy karta.coverPhoto istnieje) */}
      {karta.coverPhoto && (
        <div style={{ width: "100%", height: 100, overflow: "hidden" }}>
          <img src={karta.coverPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* Label strips (enriched, conditional: gdy karta.labels istnieje) */}
      {karta.labels && karta.labels.length > 0 && (
        <div style={{ display: "flex", gap: 4, padding: karta.coverPhoto ? "6px 10px 0" : "8px 10px 0", flexWrap: "wrap" }}>
          {karta.labels.map((l, i) => (
            <div key={i} style={{ height: 8, minWidth: 40, borderRadius: 4, background: l.color, opacity: 0.9 }} title={l.text} />
          ))}
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: "8px 10px", position: "relative" }}>
        <p style={{
          fontSize: 14, fontWeight: 400, lineHeight: 1.45,
          color: "#F4F8FB", margin: 0,
          wordBreak: "break-word",
          fontFamily: "'Inter', sans-serif",
        }}>
          {karta.title}
        </p>

        {/* Footer icons (enriched, conditional) */}
        {(karta.attachments || karta.hasDescription || karta.deadline) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            {karta.deadline && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: karta.isOverdue ? "#FF6B6B" : "#A9BBC9", background: karta.isOverdue ? "rgba(255,107,107,0.12)" : "transparent", borderRadius: 4, padding: karta.isOverdue ? "1px 5px" : 0 }}>
                <Calendar size={11} />{karta.deadline}
              </span>
            )}
            {karta.hasDescription && <AlignLeft size={12} style={{ color: "#A9BBC9" }} />}
            {karta.attachments && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#A9BBC9" }}>
                <Paperclip size={11} />{karta.attachments}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover pencil icon */}
      {hovered && state !== "dragging" && (
        <button style={{ position: "absolute", top: 4, right: 4, width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.12)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#A9BBC9" }}>
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Lista ────────────────────────────────────────────────────────────────────
function Lista({ lista, boardBg }: { lista: ListaData; boardBg?: string }) {
  const hasColoredHeader = !!lista.headerColor;

  return (
    <div style={{
      width: 272, flexShrink: 0,
      background: "rgba(0,0,0,0.30)",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      borderRadius: 12,
      display: "flex", flexDirection: "column",
      maxHeight: "calc(100vh - 110px)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 10px 8px",
        borderRadius: "12px 12px 0 0",
        background: hasColoredHeader ? lista.headerColor : "transparent",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            flex: 1, fontSize: 14, fontWeight: 600, color: "#F4F8FB",
            fontFamily: "'Space Grotesk', sans-serif",
            lineHeight: 1.3, wordBreak: "break-word",
          }}>
            {lista.title}
          </span>
          {/* Card count pill */}
          <span style={{ fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.18)", color: "#F4F8FB", borderRadius: 999, padding: "1px 7px", flexShrink: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
            {lista.cards.length}
          </span>
          {/* Collapse icon */}
          <button style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", borderRadius: 6, flexShrink: 0 }}>
            <ChevronsLeftRight size={13} />
          </button>
          {/* Menu */}
          <button style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.55)", borderRadius: 6, flexShrink: 0 }}>
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 8, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {lista.cards.length === 0 && (
          <div style={{ height: 8 }} /> // empty spacer
        )}
        {lista.cards.map(karta => (
          <KartaTablicy key={karta.id} karta={karta} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 8px", flexShrink: 0 }}>
        <button style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 6px", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.50)", fontSize: 13, borderRadius: 8, fontFamily: "'Inter', sans-serif", textAlign: "left" }}>
          <Plus size={14} /><span>Dodaj kartę</span>
        </button>
        <button style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.40)", borderRadius: 6 }}>
          <FileText size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── BoardHeaderInterior ──────────────────────────────────────────────────────
function BoardHeaderInterior({
  boardName, starred, onMenuOpen, onBack,
}: {
  boardName: string; starred: boolean; onMenuOpen: () => void; onBack: () => void;
}) {
  const [isStarred, setIsStarred] = useState(starred);

  const iconBtn = (children: React.ReactNode, label?: string, onClick?: () => void): React.ReactNode => (
    <button
      onClick={onClick}
      title={label}
      style={{ height: 36, minWidth: 36, padding: "0 8px", display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, cursor: "pointer", color: "#F4F8FB", fontSize: 13, fontFamily: "'Inter', sans-serif", flexShrink: 0 }}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      height: 56, flexShrink: 0,
      background: "rgba(0,0,0,0.28)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      display: "flex", alignItems: "center", gap: 8,
      padding: "0 14px",
    }}>
      {/* Back to grid */}
      <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#F4F8FB", flexShrink: 0 }}>
        <ChevronLeft size={16} />
      </button>

      {/* Board name */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: "#F4F8FB", whiteSpace: "nowrap", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }}>
          {boardName}
        </span>
        <button style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 6 }} title="Lista">
          <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.55)" }} />
        </button>
      </div>

      {/* Star */}
      <button onClick={() => setIsStarred(s => !s)} style={{ width: 32, height: 32, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6 }}>
        <Star size={16} fill={isStarred ? "#F5A524" : "none"} stroke={isStarred ? "#F5A524" : "rgba(255,255,255,0.60)"} />
      </button>

      <div style={{ flex: 1 }} />

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {iconBtn(<><PlugZap size={14} /><span>Power-Ups</span></>)}
        {iconBtn(<><Zap size={14} /><span>Automatyzacja</span></>)}
        {iconBtn(<Filter size={14} />, "Filtruj")}
        {/* Members */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36, padding: "0 6px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8 }}>
          {["#37A0C9", "#2BD17E", "#9B8CFF"].map((c, i) => (
            <div key={c} style={{ width: 28, height: 28, borderRadius: "50%", background: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", marginLeft: i > 0 ? -8 : 0, border: "2px solid rgba(0,0,0,0.3)", fontFamily: "'Space Grotesk', sans-serif" }}>
              {["AK", "MW", "PS"][i]}
            </div>
          ))}
        </div>
        {iconBtn(<><Share2 size={14} /><span>Udostępnij</span></>)}
        {iconBtn(<MoreHorizontal size={16} />, "Menu tablicy", onMenuOpen)}
      </div>
    </div>
  );
}

// ─── BoardMenu (slide-over) ───────────────────────────────────────────────────
function BoardMenu({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: <Share2 size={15} />,     label: "Udostępnij" },
    { icon: <AlignLeft size={15} />,  label: "O tej tablicy" },
    { icon: <EyeOff size={15} />,     label: "Widoczność" },
    { icon: <Printer size={15} />,    label: "Wydrukuj / eksportuj" },
    { icon: <Settings size={15} />,   label: "Ustawienia" },
    { icon: <Layers size={15} />,     label: "Zmień tło" },
    { icon: <Tag size={15} />,        label: "Pola niestandardowe" },
    { icon: <Zap size={15} />,        label: "Automatyzacja" },
    { icon: <Tag size={15} />,        label: "Etykiety" },
    { icon: <Activity size={15} />,   label: "Aktywność" },
    { icon: <Archive size={15} />,    label: "Zarchiwizowane elementy" },
    { icon: <ChevronsLeftRight size={15} />, label: "Zwiń wszystkie listy" },
    { icon: <Copy size={15} />,       label: "Skopiuj tablicę" },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 320, zIndex: 61,
        background: "rgba(10,20,36,0.97)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.50)",
        display: "flex", flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#F4F8FB" }}>Menu tablicy</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#A9BBC9" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {items.map((item, i) => (
            <button key={i} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "transparent", border: "none", cursor: "pointer", color: "#F4F8FB", fontSize: 14, borderRadius: 8, textAlign: "left", transition: "background 0.1s", minHeight: 44 }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <span style={{ color: "#A9BBC9", flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
function BottomNav({ active = "board" }: { active?: string }) {
  const items = [
    { id: "inbox",   icon: <Inbox size={18} />,       label: "Skrzynka odbiorcza" },
    { id: "planner", icon: <CalendarDays size={18} />, label: "Planista" },
    { id: "board",   icon: <LayoutGrid size={18} />,   label: "Tablica" },
    { id: "switch",  icon: <Shuffle size={18} />,      label: "Przełącz tablice" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom, 16px))",
      left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 4,
      background: "rgba(8,18,32,0.88)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: 999,
      padding: "6px 8px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      zIndex: 40,
    }}>
      {items.map(item => {
        const isActive = item.id === active;
        return (
          <button key={item.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 14px", borderRadius: 999,
            background: isActive ? "rgba(55,160,201,0.22)" : "transparent",
            border: isActive ? "1px solid rgba(55,160,201,0.40)" : "1px solid transparent",
            cursor: "pointer", color: isActive ? "#37A0C9" : "#A9BBC9",
            fontSize: 10, fontWeight: isActive ? 600 : 400,
            fontFamily: "'Inter', sans-serif",
            minWidth: 70,
            transition: "background 0.12s, color 0.12s",
          }}>
            {item.icon}
            <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── BoardInterior (full kanban board) ───────────────────────────────────────
function BoardInterior({
  boardName, lists, boardColor, onBack, showMenu, onMenuToggle,
}: {
  boardName: string;
  lists: ListaData[];
  boardColor: string;
  onBack: () => void;
  showMenu: boolean;
  onMenuToggle: () => void;
}) {
  return (
    <div style={{ height: "100svh", display: "flex", flexDirection: "column", background: boardColor, position: "relative", overflow: "hidden" }}>
      {/* Subtle scrim so glass panels read well */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.08)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        <BoardHeaderInterior
          boardName={boardName}
          starred={false}
          onMenuOpen={onMenuToggle}
          onBack={onBack}
        />

        {/* Canvas — horizontal scroll */}
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", display: "flex", gap: 12, padding: "12px 16px 80px", alignItems: "flex-start", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.12) transparent" }}>
          {lists.map(lista => (
            <Lista key={lista.id} lista={lista} boardBg={boardColor} />
          ))}

          {/* Add list */}
          <button style={{ width: 272, flexShrink: 0, height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", background: "rgba(255,255,255,0.14)", border: "1px dashed rgba(255,255,255,0.25)", borderRadius: 12, cursor: "pointer", color: "rgba(255,255,255,0.70)", fontSize: 14, fontFamily: "'Inter', sans-serif", alignSelf: "flex-start", marginTop: 0 }}>
            <Plus size={16} /><span>Dodaj listę</span>
          </button>
        </div>
      </div>

      <BottomNav active="board" />
      {showMenu && <BoardMenu onClose={onMenuToggle} />}
    </div>
  );
}

// ─── CardVariantsShowcase ─────────────────────────────────────────────────────
function CardVariantsShowcase({ onBack }: { onBack: () => void }) {
  const VARIANTS: { label: string; karta: KartaData; variant?: "simple" | "enriched"; state?: "default" | "hover" | "dragging" }[] = [
    { label: "simple — 1 linia",   karta: { id: "v1", title: "Klif C2!" } },
    { label: "simple — 4 linie",   karta: { id: "v2", title: "NEXO G3 KAPA I POSZEWKI NOWE NIE NASZ LOKAL. ZWRÓCIĆ DO MAGAZYNU." } },
    { label: "enriched — etykiety", karta: { id: "v3", title: "KLIF B3 - cieknący kran w kuchni", labels: [{ color: "#8B2E2E", text: "pilne" }, { color: "#C47A1E", text: "oczekuje" }] }, variant: "enriched" },
    { label: "enriched — foto + ikony", karta: { id: "v4", title: "NEXO E11 - pęknięcie płytki w łazience", coverPhoto: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&q=70", attachments: 3, hasDescription: true, deadline: "25.06", labels: [{ color: "#8B2E2E" }] }, variant: "enriched" },
    { label: "stan hover",   karta: { id: "v5", title: "Nexo D24 - 24.06" }, state: "hover" },
    { label: "stan dragging", karta: { id: "v6", title: "Kat 7 Dolozyc 2x poszewka oraz wode", labels: [{ color: "#1F7A5C" }] }, state: "dragging" },
  ];

  return (
    <div style={{ minHeight: "100svh", background: "linear-gradient(135deg, #0A1A2F 0%, #13314F 55%, #1E4D6B 100%)", padding: "28px 32px 60px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#F4F8FB" }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: "#F4F8FB" }}>
          B-05 — KartaTablicy — warianty
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {VARIANTS.map(({ label, karta, variant, state }) => (
          <div key={karta.id} style={{ width: 272 }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "#A9BBC9", marginBottom: 8 }}>{label}</p>
            <KartaTablicy karta={karta} variant={variant} state={state} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BoardGrid (A-01 / A-03) ──────────────────────────────────────────────────
function BoardCard({ board, onStarToggle, onClick }: { board: BoardData; onStarToggle: (id: string) => void; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [starHovered, setStarHovered] = useState(false);
  const coverStyle: React.CSSProperties =
    board.cover.type === "photo"
      ? { backgroundImage: `url(${board.cover.url})`, backgroundSize: "cover", backgroundPosition: "center" }
      : { background: board.cover.value };

  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: 200, minHeight: 112, borderRadius: 12, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column", boxShadow: hovered ? "0 8px 28px rgba(0,0,0,0.45)" : "0 2px 10px rgba(0,0,0,0.30)", transform: hovered ? "translateY(-2px)" : "none", transition: "transform 0.14s, box-shadow 0.14s", flexShrink: 0, position: "relative" }}>
      <div style={{ flex: "0 0 75px", position: "relative", ...coverStyle }}>
        <div style={{ position: "absolute", inset: 0, background: hovered ? "rgba(255,255,255,0.08)" : "transparent", transition: "background 0.14s" }} />
        <button onClick={e => { e.stopPropagation(); onStarToggle(board.id); }}
          onMouseEnter={() => setStarHovered(true)} onMouseLeave={() => setStarHovered(false)}
          style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: starHovered ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.25)", borderRadius: 6, border: "none", cursor: "pointer", opacity: board.starred || hovered ? 1 : 0, transition: "opacity 0.14s, background 0.14s" }}>
          <Star size={13} fill={board.starred ? "#F5A524" : "none"} stroke={board.starred ? "#F5A524" : "white"} strokeWidth={2} />
        </button>
      </div>
      <div style={{ flex: "0 0 37px", background: "rgba(8,16,30,0.88)", backdropFilter: "blur(4px)", padding: "0 10px", display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500, color: "#F4F8FB", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.35 }}>{board.name}</span>
      </div>
    </div>
  );
}

function CreateBoardTile({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: 200, minHeight: 112, borderRadius: 12, background: hovered ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)", border: `1.5px dashed ${hovered ? "rgba(55,160,201,0.60)" : "rgba(255,255,255,0.28)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", transition: "background 0.14s, border-color 0.14s", flexShrink: 0 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: hovered ? "rgba(55,160,201,0.20)" : "rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.14s" }}>
        <Plus size={16} style={{ color: hovered ? "#37A0C9" : "#A9BBC9" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500, color: hovered ? "#F4F8FB" : "#A9BBC9", fontFamily: "'Inter', sans-serif" }}>Utwórz nową tablicę</span>
    </button>
  );
}

const COVER_COLORS = [
  { value: "#0FA3B1" }, { value: "#D9912E" }, { value: "#B5483C" },
  { value: "#2B4A6F" }, { value: "#5B4A9E" }, { value: "#1F7A5C" },
];
const COVER_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&q=70" },
  { url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=200&q=70" },
];

function CreateBoardModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [selectedCover, setSelectedCover] = useState<{ type: "color" | "photo"; value: string }>({ type: "color", value: "#0FA3B1" });
  const canCreate = title.trim().length > 0;
  const previewStyle: React.CSSProperties = selectedCover.type === "photo" ? { backgroundImage: `url(${selectedCover.value})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: selectedCover.value };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", zIndex: 100, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", zIndex: 101, top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 360, background: "rgba(12,24,44,0.97)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.18)", borderTop: "1px solid rgba(255,255,255,0.28)", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.65)", overflow: "hidden", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#F4F8FB" }}>Utwórz tablicę</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "#A9BBC9" }}><X size={15} /></button>
        </div>
        <div style={{ padding: "20px" }}>
          <div style={{ width: "100%", height: 96, borderRadius: 10, overflow: "hidden", marginBottom: 20, position: "relative", ...previewStyle }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.12)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "rgba(8,16,30,0.80)" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#F4F8FB" }}>{title || "Tytuł tablicy"}</span>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#A9BBC9", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Tytuł tablicy <span style={{ color: "#FF6B6B" }}>*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Tablica Półwysep" autoFocus style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: `1px solid ${title ? "rgba(55,160,201,0.60)" : "rgba(255,255,255,0.18)"}`, color: "#F4F8FB", fontSize: 16, padding: "0 14px", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box", transition: "border 0.14s" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#A9BBC9", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Tło</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {COVER_COLORS.map(c => { const isActive = selectedCover.type === "color" && selectedCover.value === c.value; return <button key={c.value} onClick={() => setSelectedCover({ type: "color", value: c.value })} style={{ width: 40, height: 28, borderRadius: 7, background: c.value, border: isActive ? "2px solid #37A0C9" : "2px solid transparent", cursor: "pointer", outline: isActive ? "2px solid rgba(55,160,201,0.35)" : "none", outlineOffset: 1 }} />; })}
              {COVER_PHOTOS.map(p => { const isActive = selectedCover.type === "photo" && selectedCover.value === p.url; return <button key={p.url} onClick={() => setSelectedCover({ type: "photo", value: p.url })} style={{ width: 40, height: 28, borderRadius: 7, backgroundImage: `url(${p.url})`, backgroundSize: "cover", backgroundPosition: "center", border: isActive ? "2px solid #37A0C9" : "2px solid transparent", cursor: "pointer", outline: isActive ? "2px solid rgba(55,160,201,0.35)" : "none", outlineOffset: 1 }} />; })}
            </div>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#A9BBC9", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Widoczność</label>
            <button style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", color: "#F4F8FB", fontSize: 14, cursor: "pointer" }}>
              <span>Przestrzeń robocza</span><ChevronDown size={14} style={{ color: "#A9BBC9" }} />
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button disabled={!canCreate} style={{ height: 48, borderRadius: 12, width: "100%", background: canCreate ? "#37A0C9" : "rgba(55,160,201,0.25)", border: "none", cursor: canCreate ? "pointer" : "not-allowed", color: canCreate ? "white" : "rgba(255,255,255,0.35)", fontSize: 15, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", transition: "background 0.14s, color 0.14s" }}>
              {canCreate ? "Utwórz" : "Wpisz tytuł tablicy"}
            </button>
            <button onClick={onClose} style={{ height: 44, borderRadius: 12, width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#A9BBC9", fontSize: 14, cursor: "pointer" }}>Anuluj</button>
          </div>
        </div>
      </div>
    </>
  );
}

function Sidebar({ activeItem }: { activeItem: string }) {
  const items = [
    { id: "boards", icon: <LayoutGrid size={16} />, label: "Tablice" },
    { id: "templates", icon: <FileText size={16} />, label: "Szablony" },
    { id: "home", icon: <Home size={16} />, label: "Strona główna" },
  ];
  return (
    <div style={{ width: 240, flexShrink: 0, background: "#080F1A", borderRight: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "22px 20px 20px" }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, color: "#F4F8FB", letterSpacing: "-0.02em" }}>MAGZIC</span>
      </div>
      <nav style={{ padding: "0 10px 20px" }}>
        {items.map(item => { const isActive = item.id === activeItem; return <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px", height: 40, borderRadius: 10, background: isActive ? "rgba(55,160,201,0.15)" : "transparent", color: isActive ? "#37A0C9" : "#A9BBC9", cursor: "pointer", marginBottom: 2, borderLeft: isActive ? "2px solid #37A0C9" : "2px solid transparent", fontSize: 14, fontWeight: isActive ? 600 : 400 }}>{item.icon}<span>{item.label}</span></div>; })}
      </nav>
      <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "0 16px 16px" }} />
      <div style={{ padding: "0 16px" }}>
        <p style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: "#A9BBC9", marginBottom: 10 }}>Przestrzeń robocza</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, cursor: "pointer" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#37A0C9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "white", flexShrink: 0 }}>B</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#F4F8FB", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>BlueApart Serwis</span>
          <ChevronDown size={13} style={{ color: "#A9BBC9", flexShrink: 0 }} />
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <p style={{ fontSize: 11, color: "#A9BBC9", textAlign: "center" }}>magzic.com · v2.4.1</p>
      </div>
    </div>
  );
}

function BoardGrid({ boards, onStarToggle, onBoardClick, onCreateClick, isMobile, sidebarOpen, onMenuClick }: {
  boards: BoardData[]; onStarToggle: (id: string) => void; onBoardClick: (id: string) => void;
  onCreateClick: () => void; isMobile: boolean; sidebarOpen: boolean; onMenuClick: () => void;
}) {
  const starred = boards.filter(b => b.starred);
  const recent  = boards.filter(b => b.lastVisited);

  const Section = ({ icon, title, bds, showCreate }: { icon: React.ReactNode; title: string; bds: BoardData[]; showCreate?: boolean }) => (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ color: "#A9BBC9" }}>{icon}</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: "#F4F8FB" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {bds.map(b => <BoardCard key={b.id} board={b} onStarToggle={onStarToggle} onClick={() => onBoardClick(b.id)} />)}
        {showCreate && <CreateBoardTile onClick={onCreateClick} />}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* TopBar */}
      <div style={{ height: 56, flexShrink: 0, background: "rgba(8,15,26,0.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12, padding: "0 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
        {isMobile && <button onClick={onMenuClick} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "#A9BBC9", borderRadius: 8 }}><Menu size={20} /></button>}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, height: 38, borderRadius: 10, padding: "0 14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", maxWidth: 480 }}>
          <Search size={14} style={{ color: "#A9BBC9" }} />
          <span style={{ fontSize: 14, color: "#A9BBC9" }}>Szukaj tablic…</span>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onCreateClick} style={{ height: 38, padding: "0 18px", borderRadius: 10, background: "#37A0C9", border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(55,160,201,0.40)" }}><Plus size={15} strokeWidth={2.5} />Utwórz</button>
        <button style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "#A9BBC9" }}><Bell size={16} /></button>
        <button style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", color: "#A9BBC9" }}><HelpCircle size={16} /></button>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#37A0C9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: "white", cursor: "pointer" }}>AK</div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {(!isMobile || sidebarOpen) && (
          <>
            {isMobile && <div onClick={onMenuClick} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50 }} />}
            <div style={{ position: isMobile ? "fixed" : "relative", left: 0, top: 0, bottom: 0, zIndex: isMobile ? 51 : undefined, height: isMobile ? "100%" : undefined }}>
              <Sidebar activeItem="boards" />
            </div>
          </>
        )}
        <div style={{ flex: 1, overflowY: "auto", background: "linear-gradient(135deg, #0A1A2F 0%, #13314F 55%, #1E4D6B 100%)", padding: isMobile ? "20px 16px 100px" : "32px 36px 48px" }}>
          {starred.length > 0 && <Section icon={<Star size={17} fill="#F5A524" stroke="#F5A524" />} title="Tablice oznaczone gwiazdką" bds={starred} />}
          {recent.length > 0  && <Section icon={<Clock size={17} />} title="Ostatnio przeglądane" bds={recent} />}
          {/* Workspace section */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.12em", color: "#A9BBC9", marginBottom: 12 }}>Twoje przestrzenie robocze</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#37A0C9", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: "white" }}>B</div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: "#F4F8FB" }}>BlueApart Serwis</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ icon: <LayoutGrid size={14} />, label: "Tablice" }, { icon: <Users size={14} />, label: "Członkowie" }, { icon: <Settings size={14} />, label: "Ustawienia" }].map(({ icon, label }) => (
                  <button key={label} style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 12px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)", color: "#A9BBC9", fontSize: 13, cursor: "pointer" }}>{icon}{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {boards.map(b => <BoardCard key={b.id} board={b} onStarToggle={onStarToggle} onClick={() => onBoardClick(b.id)} />)}
              <CreateBoardTile onClick={onCreateClick} />
            </div>
          </div>
        </div>
      </div>
      {isMobile && <button onClick={onCreateClick} style={{ position: "fixed", right: 20, bottom: "max(24px, env(safe-area-inset-bottom, 24px))", width: 56, height: 56, borderRadius: "50%", background: "#37A0C9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 20px rgba(55,160,201,0.55)", zIndex: 40 }}><Plus size={24} color="white" strokeWidth={2.5} /></button>}
    </div>
  );
}

// ─── Screen nav bar (dev helper, top-right) ───────────────────────────────────
function ScreenNav({ current, onChange }: { current: AppScreen; onChange: (s: AppScreen) => void }) {
  const screens: { id: AppScreen; label: string }[] = [
    { id: "grid",             label: "A-01 Siatka tablic" },
    { id: "interior-teal",   label: "B-01 Zagranica (teal)" },
    { id: "interior-colored", label: "B-02 Techniczne (kolory)" },
    { id: "card-variants",   label: "B-05 Warianty kart" },
  ];
  return (
    <div style={{ position: "fixed", top: 8, right: 8, zIndex: 200, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      {screens.map(s => (
        <button key={s.id} onClick={() => onChange(s.id)}
          style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 8, cursor: "pointer", border: "none", background: current === s.id ? "#37A0C9" : "rgba(8,18,32,0.85)", color: current === s.id ? "white" : "#A9BBC9", backdropFilter: "blur(8px)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", transition: "background 0.12s", fontFamily: "'Space Grotesk', sans-serif" }}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<AppScreen>("grid");
  const [boards, setBoards] = useState<BoardData[]>(BOARDS);
  const [modalOpen, setModalOpen] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const handleStarToggle = (id: string) => setBoards(prev => prev.map(b => b.id === id ? { ...b, starred: !b.starred } : b));

  const handleBoardClick = (id: string) => {
    // b3 = Zagranica → teal, b4 = Techniczne → colored
    if (id === "b4") setScreen("interior-colored");
    else setScreen("interior-teal");
  };

  return (
    <div style={{ width: "100%", height: "100svh", fontFamily: "'Inter', sans-serif", overflow: "hidden", background: "#080F1A" }}>
      {screen === "grid" && (
        <BoardGrid
          boards={boards} onStarToggle={handleStarToggle}
          onBoardClick={handleBoardClick}
          onCreateClick={() => setModalOpen(true)}
          isMobile={isMobile} sidebarOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(o => !o)}
        />
      )}
      {screen === "interior-teal" && (
        <BoardInterior
          boardName="Tablica Zagranica (Wł+Puck)"
          lists={LISTA_TEAL}
          boardColor="#1A8B99"
          onBack={() => setScreen("grid")}
          showMenu={boardMenuOpen}
          onMenuToggle={() => setBoardMenuOpen(o => !o)}
        />
      )}
      {screen === "interior-colored" && (
        <BoardInterior
          boardName="Techniczne Zagranica (Wł+Puck)"
          lists={LISTA_COLORED}
          boardColor="#1C3456"
          onBack={() => setScreen("grid")}
          showMenu={boardMenuOpen}
          onMenuToggle={() => setBoardMenuOpen(o => !o)}
        />
      )}
      {screen === "card-variants" && (
        <CardVariantsShowcase onBack={() => setScreen("grid")} />
      )}

      {modalOpen && <CreateBoardModal onClose={() => setModalOpen(false)} />}
      <ScreenNav current={screen} onChange={setScreen} />

      <style>{`
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(169,187,201,0.6); }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        *::-webkit-scrollbar-track { background: transparent; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>
    </div>
  );
}
