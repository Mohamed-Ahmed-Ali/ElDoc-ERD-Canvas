import { createModelStore } from "./model";
import { loadPersistedGraph } from "./persist";

const persistedGraph = loadPersistedGraph();
export const store = createModelStore(persistedGraph);
export const isFirstVisit = persistedGraph === undefined;
