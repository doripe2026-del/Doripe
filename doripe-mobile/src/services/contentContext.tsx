import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ContentBundle } from "./content";
import { fallbackContentBundle, getContentBundle } from "./content";

type ContentContextValue = ContentBundle & {
  error: string | null;
  isLoading: boolean;
  reload: () => Promise<void>;
};

const ContentContext = createContext<ContentContextValue | null>(null);

export function ContentProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<ContentBundle>(fallbackContentBundle);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function reload() {
    setIsLoading(true);
    try {
      const nextBundle = await getContentBundle();
      setBundle(nextBundle);
      setError(null);
    } catch (nextError) {
      setBundle(fallbackContentBundle);
      setError(nextError instanceof Error ? nextError.message : "Failed to load Doripe content");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const value = useMemo(
    () => ({
      ...bundle,
      error,
      isLoading,
      reload,
    }),
    [bundle, error, isLoading],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const value = useContext(ContentContext);
  if (!value) {
    throw new Error("useContent must be used inside ContentProvider");
  }

  return value;
}
