// Minimal Obsidian API stub for tests. The minimap's tested modules are pure
// functions that do not depend on the host, but the stub keeps imports working.
export class Plugin {}
export class PluginSettingTab {}
export class App {}
export class TFile {}
export class TFolder {}
export class Value {}
export class StringValue extends Value {}
export class BooleanValue extends Value {}
export class NullValue extends Value { static value = new NullValue() }
export class ListValue extends Value {}
export class FileValue extends Value {}