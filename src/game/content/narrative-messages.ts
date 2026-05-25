export type NarrativeMessage = {
  title: string;
  text: string;
  isDocument?: boolean;
};

export type NarrativeMessagePools = Record<string, NarrativeMessage[]>;

function shuffle<T>(values: T[]): T[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function createNarrativeMessagesSystem() {
  let remainingPools: NarrativeMessagePools = {};

  function setPools(next: NarrativeMessagePools) {
    remainingPools = {};
    for (const [messageType, messages] of Object.entries(next)) {
      remainingPools[messageType] = shuffle(messages.map((message) => ({ ...message })));
    }
  }

  function take(messageType: string): NarrativeMessage | null {
    const remaining = remainingPools[messageType];
    if (!remaining?.length) return null;
    return remaining.pop() ?? null;
  }

  return {
    setPools,
    take,
  };
}
