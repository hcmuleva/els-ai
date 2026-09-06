import '@testing-library/jest-native/extend-expect';

// RNTL v14 calls createRoot() on 'test-renderer'.
// react-test-renderer@18.x doesn't export createRoot.
// In CI (npm workspace), npm may hoist root's react-test-renderer@18 instead of
// frontend's ^19.1.0, so we provide the adapter unconditionally.
jest.mock('test-renderer', () => {
  const tr = jest.requireActual('react-test-renderer');
  if (typeof tr.createRoot === 'function') {
    return tr; // v19+ already has it natively
  }
  return {
    ...tr,
    createRoot: (options) => {
      let instance = null;
      return {
        render: (element) => {
          if (!instance) {
            instance = tr.create(element, options);
          } else {
            instance.update(element);
          }
        },
        unmount: () => {
          if (instance) {
            try { instance.unmount(); } catch {}
          }
        },
        get container() { return instance; }
      };
    }
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

global.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.setTimeout(15000);

const origSetTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => {
  const timer = origSetTimeout(fn, ms, ...args);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
  return timer;
};

const origSetInterval = global.setInterval;
global.setInterval = (fn, ms, ...args) => {
  const timer = origSetInterval(fn, ms, ...args);
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
  return timer;
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('was not wrapped in act(...)') ||
     args[0].includes('is not configured to support act(...)'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

const { cleanup } = require('@testing-library/react-native');

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Mock FlashList to use FlatList in tests
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    FlashList: React.forwardRef((props, ref) =>
      React.createElement(FlatList, { ...props, ref })
    ),
  };
});



// Mock WebView
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: View,
  };
});



jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: jest.fn().mockImplementation(({ children }) => children),
    SafeAreaConsumer: jest.fn().mockImplementation(({ children }) => children(inset)),
    useSafeAreaInsets: jest.fn().mockReturnValue(inset),
    useSafeAreaFrame: jest.fn().mockReturnValue({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock('./src/context/AuthContext', () => {
  const React = require('react');
  const mockUser = { id: 'test-user', role: 'superadmin', organizationId: 'org1' };
  const mockContext = { user: mockUser, apiFetch: jest.fn(), token: 'test-token' };
  const AuthContext = React.createContext(mockContext);
  return {
    AuthContext,
    useAuth: () => {
      const ctx = React.useContext(AuthContext);
      if (!ctx) return mockContext;
      return ctx;
    },
    AuthProvider: ({ children }) => React.createElement(AuthContext.Provider, { value: mockContext }, children),
  };
});

jest.mock('expo-av', () => ({
  Audio: {
    Sound: jest.fn().mockImplementation(() => ({
      playAsync: jest.fn(),
      unloadAsync: jest.fn(),
      setVolumeAsync: jest.fn(),
      getStatusAsync: jest.fn(),
    })),
  },
  Video: jest.fn().mockImplementation(() => ({
    playAsync: jest.fn(),
    pauseAsync: jest.fn(),
  })),
}));
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb) => {
      React.useEffect(() => {
        const cleanup = cb();
        if (typeof cleanup === 'function') {
          return cleanup;
        }
      }, []);
    },
    Link: ({ children }) => children,
  };
});
