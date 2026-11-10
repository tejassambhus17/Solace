import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, useColorScheme, type ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightColors = {
  bg: "#FAF8FC",
  surface: "#FFFFFF",
  surface2: "#F3EDF8",
  text: "#2B2038",
  muted: "#65586E",
  primary: "#D8B4F0",
  primaryText: "#2B2038",
  lavenderAction: "#E7D3F4",
  lavenderActionText: "#372346",
  border: "#DDD3E5",
  accent: "#634579",
  lavender: "#C5A4DA",
  peach: "#DC9E86",
  lavenderSurface: "#F0E5F7",
  lavenderText: "#583B6C",
  tabActiveSurface: "#E7D5F4",
  tabActiveText: "#4F3265",
  peachSurface: "#F8E8E3",
  peachText: "#75463D",
  sageSurface: "#EDF2EC",
  sageText: "#3C5949",
  heroSurface: "#F1EAF5",
  heroMuted: "#65586E",
  heroBorder: "#DDD0E5",
  danger: "#983C45",
  overlay: "#23183272",
};

export const lightGlass = {
  tint: "#F8F2FC",
  veil: "#FBF7FDB8",
  fallback: "#FBF7FDF8",
  edge: "#B8A6C7",
  ink: "#483553",
};
export const darkColors: typeof lightColors = {
  bg: "#000000",
  surface: "#141416",
  surface2: "#202022",
  text: "#F4EEE6",
  muted: "#B6B0AA",
  primary: "#D8B4F0",
  primaryText: "#251732",
  lavenderAction: "#D8B4F0",
  lavenderActionText: "#251732",
  border: "#2C2B2F",
  accent: "#C49BDE",
  lavender: "#BDA6CE",
  peach: "#E8B899",
  lavenderSurface: "#211E27",
  lavenderText: "#D7C8E6",
  tabActiveSurface: "#392B46",
  tabActiveText: "#E5CCF5",
  peachSurface: "#28201D",
  peachText: "#E8C5AD",
  sageSurface: "#1D2521",
  sageText: "#C0D3C6",
  heroSurface: "#181719",
  heroMuted: "#D1C4BA",
  heroBorder: "#39302B",
  danger: "#FF9D93",
  overlay: "#00000099",
};
type ThemeMode = "light" | "dark" | "system";
type ThemeValue = {
  colors: typeof lightColors;
  mode: ThemeMode;
  resolved: "light" | "dark";
  ready: boolean;
  setMode: (mode: ThemeMode) => void;
  saveMode: (mode: ThemeMode) => Promise<void>;
};
const Context = createContext<ThemeValue>({
  colors: lightColors,
  mode: "system",
  resolved: "light",
  ready: true,
  setMode: () => {},
  saveMode: async () => {
    throw new Error("Appearance preferences are unavailable.");
  },
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setTheme] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);
  const requested = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    AsyncStorage.getItem("solace.theme")
      .then((v) => {
        if (
          !requested.current &&
          (v === "light" || v === "dark" || v === "system")
        )
          setTheme(v);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  const saveMode = useCallback((value: ThemeMode) => {
    requested.current = true;
    const write = writes.current.then(async () => {
      await AsyncStorage.setItem("solace.theme", value);
      setTheme(value);
    });
    writes.current = write.catch(() => {});
    return write;
  }, []);
  const resolved =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const value = useMemo(
    () => ({
      colors: resolved === "dark" ? darkColors : lightColors,
      mode,
      resolved,
      ready,
      saveMode,
      setMode: (value: ThemeMode) => {
        void saveMode(value).catch(() => {});
      },
    }),
    [mode, ready, resolved, saveMode],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);

const experienceDarkColors: typeof lightColors = {
  ...darkColors,
  bg: "#141225",
  surface: "#231D36",
  surface2: "#2C2440",
  text: "#F7EFF8",
  muted: "#CDC1D7",
  border: "#524261",
  lavender: "#D6A9F7",
  lavenderSurface: "#3C2A53",
  lavenderText: "#E9CCFF",
  tabActiveSurface: "#D7A5F4",
  tabActiveText: "#30203C",
  peach: "#FFD0AC",
  peachSurface: "#4B313C",
  peachText: "#FFDBC4",
  sageSurface: "#253735",
  heroSurface: "#19162D",
  heroMuted: "#D9CCDF",
  heroBorder: "#524261",
};

export function ExperienceTheme({
  children,
  enabled = true,
  useBaseCanvas = false,
}: {
  children: React.ReactNode;
  enabled?: boolean;
  useBaseCanvas?: boolean;
}) {
  const theme = useTheme();
  const value = useMemo(
    () =>
      enabled && theme.resolved === "dark"
        ? {
            ...theme,
            colors: useBaseCanvas
              ? { ...experienceDarkColors, bg: theme.colors.bg }
              : experienceDarkColors,
          }
        : theme,
    [enabled, theme, useBaseCanvas],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function artGradient(value: string): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { backgroundImage: value } as ViewStyle,
    default: { experimental_backgroundImage: value },
  })!;
}
