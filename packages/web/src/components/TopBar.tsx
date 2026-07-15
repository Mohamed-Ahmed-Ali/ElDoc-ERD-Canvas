import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  ChevronDown,
  Target,
  Share2,
  FileText,
  Image as ImageIcon,
  Code,
  Undo,
  Redo,
  CheckSquare,
  Palette,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";
import { LibraryIcon } from "../lib/icons";
import { useTheme, themeStore, type ThemeName } from "../state/theme";
import { LogoIcon } from "./LogoIcon";

// first-visit onboarding hint pointing at the Library. Persisted so it only
// ever shows once per browser; dismissed as soon as the user hovers it.
const LIBRARY_HINT_KEY = "mc.libraryHint.v1";

export interface TopBarProps {
  viewMode?: "physical" | "logical" | "compact";
  onViewModeChange?: (mode: "physical" | "logical" | "compact") => void;
  onImport?: () => void;
  onExport?: () => void;
  onExportSql?: (dialect: string) => void;
  onExportCsv?: () => void;
  onExportDbml?: () => void;
  exportDisabled?: boolean;
  onShare?: () => void;
  shareDisabled?: boolean;
  onLibrary?: () => void;
  onOpenSqlEditor?: () => void;
  onOpenTemplateLibrary?: () => void;
  onValidate?: () => void;
  onDictionary?: () => void;
  dictionaryDisabled?: boolean;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  highlightDepth?: "None" | "1 Level" | "2 Levels" | "All";
  onHighlightDepthChange?: (depth: "None" | "1 Level" | "2 Levels" | "All") => void;
}

export function TopBar({
  viewMode = "physical",
  onViewModeChange,
  onImport,
  onExport,
  onExportSql,
  onExportCsv,
  onExportDbml,
  exportDisabled = false,
  onShare,
  shareDisabled = false,
  onLibrary,
  onOpenSqlEditor,
  onOpenTemplateLibrary,
  onValidate,
  onDictionary,
  dictionaryDisabled = false,
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  highlightDepth = "None",
  onHighlightDepthChange,
}: TopBarProps) {
  // export dropdown (OKF markdown / PNG / SVG).
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  // highlight depth dropdown
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  // show the Library hint on first ever visit; stays lit until hovered.
  const [showLibraryHint, setShowLibraryHint] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const activeTheme = useTheme();
  useEffect(() => {
    try {
      if (!localStorage.getItem(LIBRARY_HINT_KEY)) setShowLibraryHint(true);
    } catch {
      /* private mode */
    }
  }, []);
  const dismissLibraryHint = () => {
    setShowLibraryHint(false);
    try {
      localStorage.setItem(LIBRARY_HINT_KEY, "seen");
    } catch {
      /* private mode */
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-[9px] bg-white border-b border-[#d8dee8] flex-shrink-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-[9px] font-[650] text-[15px] tracking-[-0.2px]">
        <LogoIcon className="w-[24px] h-[24px]" />
        <span>ElDoc ERD Canvas</span>
      </div>
      <div className="w-4" /> {/* Spacer */}
      {/* View Mode Segmented Control */}
      {onViewModeChange && (
        <div className="flex bg-[#f1f3f7] p-1 rounded-lg">
          {(["physical", "logical", "compact"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-3 py-1 text-[13px] font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      )}
      {/* Theme Selector */}
      <div className="relative ml-2">
        <button
          onClick={() => setThemeMenuOpen((o) => !o)}
          className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
        >
          <Palette size={15} /> Theme <ChevronDown size={14} className="text-slate-400" />
        </button>
        {themeMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setThemeMenuOpen(false)} />
            <div
              role="menu"
              className="absolute top-[calc(100%+6px)] left-0 z-50 w-[160px] rounded-lg border border-[#d8dee8] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] py-1"
            >
              {(["light", "dark", "react-flow", "turbo"] as ThemeName[]).map((t) => (
                <button
                  key={t}
                  role="menuitem"
                  onClick={() => {
                    themeStore.set(t);
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full text-left text-[13px] px-3 py-2 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] ${activeTheme === t ? "text-[#1e88e5] font-semibold bg-[#e6f1fb]" : "text-slate-900"}`}
                >
                  {t === "react-flow" ? "React Flow" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex-1" />
      {/* Undo / Redo */}
      <div className="flex items-center gap-[4px] mr-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="text-slate-600 border border-transparent hover:bg-[#f1f3f7] rounded-lg p-[6px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="text-slate-600 border border-transparent hover:bg-[#f1f3f7] rounded-lg p-[6px] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Redo size={16} />
        </button>
      </div>
      {/* Templates */}
      <div className="relative">
        {/* Pulsing ring highlights the Templates control on first visit */}
        {showLibraryHint && (
          <span className="absolute -inset-[3px] rounded-[10px] ring-2 ring-[#1e88e5]/60 animate-pulse pointer-events-none" />
        )}
        <button
          onClick={() => {
            dismissLibraryHint();
            onLibrary?.();
          }}
          title="Browse model templates"
          className="text-[13px] font-[550] text-slate-900 border border-[#d8dee8] bg-white rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
        >
          <LibraryIcon size={15} /> Templates
        </button>
        {showLibraryHint && (
          <div
            role="tooltip"
            onMouseEnter={dismissLibraryHint}
            className="absolute top-[calc(100%+11px)] right-0 z-40 w-[232px] rounded-lg bg-slate-900 text-white text-[12.5px] leading-[1.45] px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.28)] cursor-default"
          >
            <span className="absolute -top-[5px] right-[18px] w-[10px] h-[10px] bg-slate-900 rotate-45" />
            Roll out a ready-made model from the templates — or build your own from scratch.
          </div>
        )}
      </div>
      <button
        onClick={onImport}
        className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
      >
        <Download size={15} /> Import
      </button>
      {/* Validate */}
      <button
        onClick={onValidate}
        className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
      >
        <CheckSquare size={15} /> Validate
      </button>
      {/* Dictionary */}
      <button
        onClick={onDictionary}
        disabled={dictionaryDisabled}
        title={
          dictionaryDisabled ? "Add a mart first" : "Open Business Dictionary (Glossary & KPIs)"
        }
        className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <BookOpen size={15} /> Dictionary
      </button>
      <div className="w-px h-6 bg-[#d8dee8] mx-1" /> {/* Divider */}
      {/* Highlight Depth */}
      <div className="relative">
        <button
          onClick={() => setHighlightMenuOpen((o) => !o)}
          title="Highlight depth when clicking a table"
          className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7]"
        >
          <Target size={15} /> Depth: {highlightDepth} <ChevronDown size={14} className="text-slate-400" />
        </button>
        {highlightMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setHighlightMenuOpen(false)} />
            <div
              role="menu"
              className="absolute top-[calc(100%+6px)] left-0 z-50 w-[140px] rounded-lg border border-[#d8dee8] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] py-1"
            >
              {(["None", "1 Level", "2 Levels", "All"] as const).map((d) => (
                <button
                  key={d}
                  role="menuitem"
                  onClick={() => {
                    onHighlightDepthChange?.(d);
                    setHighlightMenuOpen(false);
                  }}
                  className={`w-full text-left text-[13px] px-3 py-2 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] ${highlightDepth === d ? "text-[#1e88e5] font-semibold bg-[#e6f1fb]" : "text-slate-900"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Export — dropdown: OKF markdown, PNG image, SVG image */}
      <div className="relative">
        <button
          onClick={() => setExportMenuOpen((o) => !o)}
          disabled={exportDisabled}
          aria-haspopup="menu"
          aria-expanded={exportMenuOpen}
          title={exportDisabled ? "Add a mart first, then export" : "Export this model"}
          className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={15} /> Export <ChevronDown size={14} className="text-slate-400" />
        </button>
        {exportMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
            <div
              role="menu"
              className="absolute top-[calc(100%+6px)] right-0 z-50 w-[232px] rounded-lg border border-[#d8dee8] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] py-1"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExport?.();
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-2 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7]"
              >
                <FileText size={15} className="text-slate-500" /> OKF (Markdown)
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportCsv?.();
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-2 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7]"
              >
                <FileText size={15} className="text-slate-500" /> CSV (Data Dictionary)
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportDbml?.();
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-2 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7]"
              >
                <FileText size={15} className="text-slate-500" /> DBML (Database Markup Language)
              </button>

              <div className="w-full px-3 pt-3 pb-1 mt-1 border-t border-[#d8dee8] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                SQL Dialects
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSql?.("snowflake");
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-1.5 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] pl-8"
              >
                Snowflake
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSql?.("bigquery");
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-1.5 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] pl-8"
              >
                BigQuery
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSql?.("postgres");
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-1.5 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] pl-8"
              >
                PostgreSQL
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSql?.("tsql");
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-1.5 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] pl-8"
              >
                SQL Server (T-SQL)
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSql?.("mysql");
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-1.5 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] pl-8"
              >
                MySQL
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSql?.("sparksql");
                }}
                className="w-full text-left text-[13px] text-slate-900 px-3 py-1.5 cursor-pointer flex items-center gap-[8px] hover:bg-[#f1f3f7] pl-8"
              >
                SparkSQL
              </button>
            </div>
          </>
        )}
      </div>
      {/* Share — copy a link that reopens this exact model */}
      <button
        onClick={onShare}
        disabled={shareDisabled}
        title={
          shareDisabled ? "Add a mart first, then share" : "Copy a shareable link to this model"
        }
        className="text-[13px] font-[550] border border-[#d8dee8] bg-white text-slate-900 rounded-lg px-3 py-[7px] cursor-pointer flex items-center gap-[6px] hover:bg-[#f1f3f7] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Share2 size={15} /> Share
      </button>
    </div>
  );
}
