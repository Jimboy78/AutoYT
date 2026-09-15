"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProject,
  getProjectFile,
  getRenderFile,
  listProjects,
  listRenders,
  subscribeLibrary,
  type Project,
  type Render,
} from "./index";

interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs `load` and re-runs it whenever the library changes (unless `live` is false). */
export function useLibraryQuery<T>(load: () => Promise<T>, deps: unknown[], live = true): Query<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const cancel = reload();
    const unsubscribe = live ? subscribeLibrary(reload) : undefined;
    return () => {
      cancel();
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload };
}

export const useProjects = () => useLibraryQuery<Project[]>(listProjects, []);

export const useProject = (id: string | null | undefined) =>
  useLibraryQuery<Project | undefined>(() => (id ? getProject(id) : Promise.resolve(undefined)), [id]);

export const useRenders = (projectId?: string | null) =>
  useLibraryQuery<Render[]>(() => listRenders(projectId), [projectId]);

export function useBlobUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

/** Object URL of a project's original file. Not live: re-fetching the blob would reload players. */
export function useProjectFileUrl(id: string | null | undefined) {
  const { data } = useLibraryQuery<Blob | undefined>(() => (id ? getProjectFile(id) : Promise.resolve(undefined)), [id], false);
  return useBlobUrl(data);
}

export function useRenderFileUrl(id: string | null | undefined) {
  const { data } = useLibraryQuery<Blob | undefined>(() => (id ? getRenderFile(id) : Promise.resolve(undefined)), [id], false);
  return useBlobUrl(data);
}

const ACTIVE_KEY = "autoyt.activeProject";

/** Selected project shared across pages: `?p=` wins, then the last one used, then the most recent. */
export function useActiveProject() {
  const projects = useProjects();
  const [wanted, setWanted] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("p");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ACTIVE_KEY);
    } catch {
      stored = null;
    }
    setWanted(fromUrl ?? stored);
  }, []);

  const list = projects.data ?? [];
  const project = list.find((p) => p.id === wanted) ?? list[0];

  const select = useCallback((id: string) => {
    setWanted(id);
    try {
      window.localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      // Selection still works for this page without storage.
    }
  }, []);

  return { projects: list, loading: projects.loading, error: projects.error, project, select };
}
