const ambientPlayers = new Set<() => void>();

export function registerAmbientPlayback(stop: () => void) {
  ambientPlayers.add(stop);
  return () => {
    ambientPlayers.delete(stop);
  };
}

export function interruptAmbientPlayback() {
  for (const stop of [...ambientPlayers]) stop();
}
