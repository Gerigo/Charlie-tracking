import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * In-tree modal portal.
 *
 * React Native's <Modal> renders into a body-level portal on the web, which
 * escapes the PhoneFrame's centering and exposes the layout to iOS Safari's
 * visualViewport gymnastics around the soft keyboard — that's the root cause
 * of the "carnet shifted sideways after typing in a modal" bug. By keeping
 * every modal inside the same React tree as the rest of the app (mounted by
 * <ModalHost/> as a sibling of the screen body) the iOS keyboard transition
 * can't drag the document anywhere it shouldn't be, because there's no
 * separate portal for it to attach to.
 *
 * Usage:
 *   <ModalPortalProvider>
 *     <PhoneFrame>
 *       <Shell />
 *       <ModalHost />   // overlays the frame, only renders when modals open
 *     </PhoneFrame>
 *   </ModalPortalProvider>
 *
 * Then any descendant component renders <ModalPortal>…</ModalPortal> and its
 * children get hoisted into the host.
 */

type Registry = Map<string, ReactNode>;
type Api = { set: (id: string, node: ReactNode | null) => void };

const ApiContext = createContext<Api | null>(null);
const RegistryContext = createContext<Registry>(new Map());

export function ModalPortalProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Registry>(() => new Map());

  const api = useMemo<Api>(
    () => ({
      set: (id, node) => {
        setRegistry((prev) => {
          if (node === null) {
            if (!prev.has(id)) return prev;
            const next = new Map(prev);
            next.delete(id);
            return next;
          }
          if (prev.get(id) === node) return prev;
          const next = new Map(prev);
          next.set(id, node);
          return next;
        });
      },
    }),
    [],
  );

  return (
    <ApiContext.Provider value={api}>
      <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>
    </ApiContext.Provider>
  );
}

/**
 * Renders every registered modal as an absolute-fill overlay above the host's
 * parent. Place this once near the top of the PhoneFrame so overlays cover
 * the entire phone-shaped visible area (and only that area on desktop).
 */
export function ModalHost() {
  const registry = useContext(RegistryContext);
  if (registry.size === 0) return null;
  const entries = Array.from(registry.entries());
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, hostStyles.host]}>
      {entries.map(([id, node]) => (
        <View
          key={id}
          pointerEvents="box-none"
          style={StyleSheet.absoluteFillObject}
        >
          {node}
        </View>
      ))}
    </View>
  );
}

const hostStyles = StyleSheet.create({
  host: {
    // Above the tab bar (which doesn't set a zIndex but lives in normal flow)
    // and any in-flow content. Stays inside the phone frame regardless.
    zIndex: 100,
  },
});

function useModalPortalApi(): Api {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('ModalPortal used outside <ModalPortalProvider>');
  }
  return api;
}

/**
 * Hoists its children into the active <ModalHost/>. Renders nothing where
 * it's invoked. Unmount removes the entry from the host.
 *
 * Pass a stable `id` if you need to identify the entry yourself; otherwise
 * a useId-backed id is generated.
 */
export function ModalPortal({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const portalId = id ?? autoId;
  const { set } = useModalPortalApi();

  useEffect(() => {
    set(portalId, children);
    return () => set(portalId, null);
  }, [children, portalId, set]);

  return null;
}

export function useModalPortal() {
  return useModalPortalApi();
}
