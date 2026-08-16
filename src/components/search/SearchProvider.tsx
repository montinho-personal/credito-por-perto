"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { trackSearchOpen, type SearchSource } from "./analytics";

// O modal (e o motor, importado dentro dele) só entram no bundle quando
// o usuário demonstra intenção de buscar.
const SearchDialog = dynamic(
  () => import("./SearchDialog").then((mod) => mod.SearchDialog),
  { ssr: false },
);

interface SearchContextValue {
  openSearch: (source: SearchSource, initialQuery?: string) => void;
}

const SearchContext = createContext<SearchContextValue>({
  openSearch: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SearchSource>("header");
  const [initialQuery, setInitialQuery] = useState("");
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const openSearch = useCallback((from: SearchSource, query = "") => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSource(from);
    setInitialQuery(query);
    setOpen(true);
    trackSearchOpen(from);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    restoreFocusRef.current?.focus();
  }, []);

  // Atalhos globais: "/" e Cmd/Ctrl+K (fora de campos de digitação).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const cmdK =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const slash =
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingContext(event.target);
      if (cmdK || slash) {
        event.preventDefault();
        openSearch("atalho");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  return (
    <SearchContext.Provider value={{ openSearch }}>
      {children}
      {open ? (
        <SearchDialog
          source={source}
          initialQuery={initialQuery}
          onClose={closeSearch}
        />
      ) : null}
    </SearchContext.Provider>
  );
}
