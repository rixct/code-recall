import { type App, PluginSettingTab, Setting } from "obsidian";
import type CodeRecallPlugin from "../main";

/** Settings UI for CodeRecall. */
export class CodeRecallSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: CodeRecallPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Syntax highlighting")
			.setDesc("Highlight code (JavaScript, Python, C++, Java, …) in the review view and in-note cards.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.syntaxHighlight).onChange(async (value) => {
					this.plugin.settings.syntaxHighlight = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Execution").setHeading();

		new Setting(containerEl)
			.setName("Native execution (C++ / Java)")
			.setDesc(
				"Compile and run C++ and Java with your local toolchains (g++/clang++, JDK 11+). " +
					"This runs real programs on your machine — only review notes you trust. " +
					"When off, C++ uses the bundled JSCPP interpreter (no STL) and Java is disabled.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.nativeExecution).onChange(async (value) => {
					this.plugin.settings.nativeExecution = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("C++ compiler")
			.setDesc("Command to use for C++. Leave empty to auto-detect (g++, then clang++).")
			.addText((text) =>
				text
					.setPlaceholder("auto (g++ / clang++)")
					.setValue(this.plugin.settings.cppCompiler)
					.onChange(async (value) => {
						this.plugin.settings.cppCompiler = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
