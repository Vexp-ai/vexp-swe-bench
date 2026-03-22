import type { AgentAdapter } from "./adapter.js";
/**
 * Look up an agent adapter by name.
 *
 * To add a new agent, implement the AgentAdapter interface and register it here.
 * See docs/CONTRIBUTING.md for details.
 */
export declare function getAdapter(name: string): AgentAdapter;
