import type { Persistence } from 'firebase/auth';

interface ReactNativeStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type PersistenceValue = Record<string, unknown> | string;

const STORAGE_AVAILABLE_KEY = '__charlie_mobile_auth_storage__';

interface PersistenceInternal extends Persistence {
  _isAvailable(): Promise<boolean>;
  _set(key: string, value: PersistenceValue): Promise<void>;
  _get<T extends PersistenceValue>(key: string): Promise<T | null>;
  _remove(key: string): Promise<void>;
  _addListener(key: string, listener: (value: PersistenceValue | null) => void): void;
  _removeListener(key: string, listener: (value: PersistenceValue | null) => void): void;
  _shouldAllowMigration?: boolean;
}

export function createReactNativePersistence(storage: ReactNativeStorageLike): Persistence {
  const persistence: PersistenceInternal = {
    type: 'LOCAL',
    async _isAvailable() {
      try {
        await storage.setItem(STORAGE_AVAILABLE_KEY, '1');
        await storage.removeItem(STORAGE_AVAILABLE_KEY);
        return true;
      } catch {
        return false;
      }
    },
    async _set(key: string, value: PersistenceValue) {
      await storage.setItem(key, JSON.stringify(value));
    },
    async _get<T extends PersistenceValue>(key: string) {
      const value = await storage.getItem(key);
      return value ? (JSON.parse(value) as T) : null;
    },
    async _remove(key: string) {
      await storage.removeItem(key);
    },
    _addListener() {
      // AsyncStorage does not expose cross-process auth change listeners in this app.
    },
    _removeListener() {
      // No-op for the same reason as above.
    },
    _shouldAllowMigration: true,
  };

  return persistence as unknown as Persistence;
}
