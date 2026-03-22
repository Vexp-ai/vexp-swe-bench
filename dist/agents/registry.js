import { ClaudeCodeAdapter } from "./claude-code.js";
const adapters = {
    "claude-code": () => new ClaudeCodeAdapter(),
};
/**
 * Look up an agent adapter by name.
 *
 * To add a new agent, implement the AgentAdapter interface and register it here.
 * See docs/CONTRIBUTING.md for details.
 */
export function getAdapter(name) {
    const factory = adapters[name];
    if (!factory) {
        const available = Object.keys(adapters).join(", ");
        throw new Error(`Unknown agent "${name}". Available adapters: ${available}\n` +
            `See docs/CONTRIBUTING.md to add a new agent adapter.`);
    }
    return factory();
}
//# sourceMappingURL=registry.js.map