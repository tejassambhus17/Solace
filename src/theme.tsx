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
  muted: "#697164",
  primary: "#2D5038",
  primaryText: "#FFF9EC",
  border: "#E6DACE",
  accent: "#A9B17C",
  lavender: "#D9C1D8",
  peach: "#F1B28A",
  danger: "#A64942",
  overlay: "#00000070",
};
export const darkColors: typeof lightColors = {
  bg: "#000000",
  surface: "#111112",
  surface2: "#1D1D1F",
  text: "#F5F0E8",
  muted: "#B4B0AA",
  primary: "#EBDFCB",
  primaryText: "#191715",
  border: "#303033",
  accent: "#B8A88D",
  lavender: "#BDA6CE",
  peach: "#E8B899",
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
