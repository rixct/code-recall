import { type App, PluginSettingTab, Setting } from "obsidian";
import { type LangSetting, setLangOverride, t } from "../i18n";
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
		const m = t();
		containerEl.empty();

		new Setting(containerEl)
			.setName(m.setLangName)
			.setDesc(m.setLangDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ auto: m.langAuto, en: "English", ru: "Русский" })
					.setValue(this.plugin.settings.language)
					.onChange(async (value) => {
						this.plugin.settings.language = value as LangSetting;
						setLangOverride(this.plugin.settings.language);
						await this.plugin.saveSettings();
						this.display(); // re-render the tab in the newly chosen language
					}),
			);

		new Setting(containerEl)
			.setName(m.setSyntaxName)
			.setDesc(m.setSyntaxDesc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.syntaxHighlight).onChange(async (value) => {
					this.plugin.settings.syntaxHighlight = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName(m.setExecHeading).setHeading();

		new Setting(containerEl)
			.setName(m.setNativeName)
			.setDesc(m.setNativeDesc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.nativeExecution).onChange(async (value) => {
					this.plugin.settings.nativeExecution = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(m.setCompilerName)
			.setDesc(m.setCompilerDesc)
			.addText((text) =>
				text
					.setPlaceholder(m.setCompilerPlaceholder)
					.setValue(this.plugin.settings.cppCompiler)
					.onChange(async (value) => {
						this.plugin.settings.cppCompiler = value.trim();
						await this.plugin.saveSettings();
					}),
			);
	}
}
