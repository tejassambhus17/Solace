import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightColors = {
  bg: "#FBF0E8",
  surface: "#FFF8F2",
  surface2: "#EEE8D6",
  text: "#183A2B",
  muted: "#626B5D",
  primary: "#2D5038",
  primaryText: "#FFF9EC",
  border: "#E6DACE",
  accent: "#A9B17C",
  lavender: "#D9C1D8",
  peach: "#F1B28A",
  lavenderSurface: "#EEE4F5",
  lavenderText: "#59436D",
  tabActiveSurface: "#EEE4F5",
  tabActiveText: "#59436D",
  peachSurface: "#F9E2D2",
  peachText: "#794B34",
  sageSurface: "#E5EDDF",
  sageText: "#3C5949",
  heroSurface: "#F2E5D3",
  heroMuted: "#52604D",
  heroBorder: "#E3D3C1",
  danger: "#A64942",
  overlay: "#00000070",
};
export const darkColors: typeof lightColors = {
  bg: "#000000",
  surface: "#141416",
  surface2: "#202022",
  text: "#F4EEE6",
  muted: "#B6B0AA",
  primary: "#E7C7A8",
  primaryText: "#2B211A",
  border: "#2C2B2F",
  accent: "#B8A88D",
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
  setMode: (mode: ThemeMode) => void;
};
const Context = createContext<ThemeValue>({
  colors: lightColors,
  mode: "system",
  resolved: "light",
  setMode: () => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setTheme] = useState<ThemeMode>("system");
  useEffect(() => {
    AsyncStorage.getItem("solace.theme")
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setTheme(v);
      })
      .catch(() => {});
  }, []);
  const setMode = (v: ThemeMode) => {
    setTheme(v);
    AsyncStorage.setItem("solace.theme", v).catch(() => {});
  };
  const resolved =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const value = useMemo(
    () => ({
      colors: resolved === "dark" ? darkColors : lightColors,
      mode,
      resolved,
      setMode,
    }),
    [mode, resolved],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
