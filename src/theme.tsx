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
  bg: "#F8EDE3",
  surface: "#FFF7EF",
  surface2: "#EFE5D4",
  text: "#193326",
  muted: "#687568",
  primary: "#27452E",
  primaryText: "#FFF9EC",
  border: "#DED4C1",
  accent: "#A9B17C",
  lavender: "#D9C1D8",
  peach: "#F1B28A",
  danger: "#A64942",
  overlay: "#00000070",
};
export const darkColors: typeof lightColors = {
  bg: "#111D16",
  surface: "#1D2B20",
  surface2: "#273527",
  text: "#F9EEDC",
  muted: "#B3BDA9",
  primary: "#C5D49A",
  primaryText: "#16271A",
  border: "#435344",
  accent: "#A5B77C",
  lavender: "#B89CBE",
  peach: "#E6AE83",
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
