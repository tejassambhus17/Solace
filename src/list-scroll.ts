import { useRef } from "react";
import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

export function useListScrollRestore<Item>(savedOffset: unknown) {
  const ref = useRef<FlatList<Item>>(null);
  const offset = useRef(0);
  const target = useRef(
    typeof savedOffset === "number" && Number.isFinite(savedOffset)
      ? Math.max(0, savedOffset)
      : 0,
  );
  const measured = useRef({ viewport: 0, content: 0, attempted: 0 });

  function restore() {
    const { viewport, content, attempted } = measured.current;
    if (!ref.current || !target.current || !viewport) return;
    // FlatList expands its trailing spacer as cells are measured. Move as far
    // as the current layout permits and retry when the next batch is ready.
    const reachable = Math.min(target.current, Math.max(0, content - viewport));
    if (reachable <= attempted) return;
    measured.current.attempted = reachable;
    if (reachable >= target.current) target.current = 0;
    ref.current.scrollToOffset({ offset: reachable, animated: false });
  }

  return {
    offset,
    props: {
      ref,
      onLayout({ nativeEvent }: LayoutChangeEvent) {
        measured.current.viewport = nativeEvent.layout.height;
        restore();
      },
      onContentSizeChange(_width: number, height: number) {
        measured.current.content = height;
        restore();
      },
      onScroll({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
        offset.current = Math.max(0, nativeEvent.contentOffset.y);
      },
      onScrollBeginDrag() {
        target.current = 0;
      },
      scrollEventThrottle: 32,
    },
  };
}
