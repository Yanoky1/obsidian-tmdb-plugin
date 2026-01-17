/**
 * settings.ts
 *
 * Plugin settings interface, defaults, and settings tab.
 * Manages API token, templates, folders, and image handling configuration.
 */

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ObsidianTMDBPlugin from "main";
import { FolderSuggest } from "./Suggesters/FolderSuggester";
import { FileSuggest } from "./Suggesters/FileSuggester";
import { TMDBProvider } from "../APIProvider/provider";
import {
	t,
	setLanguage,
	getSupportedLanguages,
	SupportedLanguage,
} from "../i18n";

const docUrl =
	"https://github.com/2PleXXX/obsidian-TMDB-search-plus-plugin";
const apiSite = "https://TMDB.dev/";

export interface ObsidianTMDBPluginSettings {
	language: SupportedLanguage;
	apiToken: string;
	apiTokenValid: boolean;
	movieFileNameFormat: string;
	movieFolder: string;
	movieTemplateFile: string;
	seriesFileNameFormat: string;
	seriesFolder: string;
	seriesTemplateFile: string;

	// actors settings
	actorsPath: string;
	directorsPath: string;
	writersPath: string;
	producersPath: string;

	// Image settings
	imagesFolder: string;
	saveImagesLocally: boolean;
	savePosterImage: boolean;
	saveCoverImage: boolean;
	saveLogoImage: boolean;
	imageFileNameFormat: string;

	// Mobile settings
	mobileCoverHeightMultiplier: number;
}

export const DEFAULT_SETTINGS: ObsidianTMDBPluginSettings = {
	language: "en",
	apiToken: "",
	apiTokenValid: false,
	movieFileNameFormat: "",
	movieFolder: "",
	movieTemplateFile: "",
	seriesFileNameFormat: "",
	seriesFolder: "",
	seriesTemplateFile: "",

	// Image settings
	actorsPath: "",
	directorsPath: "",
	writersPath: "",
	producersPath: "",

	// Image defaults
	imagesFolder: "attachments/TMDB",
	saveImagesLocally: false,
	savePosterImage: true,
	saveCoverImage: false,
	saveLogoImage: false,
	imageFileNameFormat: "{{nameForFile}}_{{id}}_{{type}}", // Default format with name, id, and type

	// Mobile settings
	mobileCoverHeightMultiplier: 1.5,
};

export class ObsidianTMDBSettingTab extends PluginSettingTab {
	private validationTimeout: NodeJS.Timeout | null = null;
	private TMDBProvider: TMDBProvider;

	constructor(app: App, private plugin: ObsidianTMDBPlugin) {
		super(app, plugin);
		this.TMDBProvider = new TMDBProvider();

		// Set language from settings on creation
		setLanguage(this.plugin.settings.language);
	}

	get settings() {
		return this.plugin.settings;
	}

	onClose(): void {
		if (this.validationTimeout) {
			clearTimeout(this.validationTimeout);
			this.validationTimeout = null;
		}
	}

	/**
	 * Update token validation visual indicator
	 */
	private updateTokenValidationIndicator(
		inputElement: HTMLInputElement,
		isValid: boolean | null
	): void {
		if (!inputElement) return;

		// Remove previous indicator classes
		inputElement.removeClass(
			"TMDB-plugin__token-valid",
			"TMDB-plugin__token-invalid",
			"TMDB-plugin__token-checking"
		);

		// Add appropriate class
		if (this.plugin.settings.apiToken.trim() !== "") {
			if (isValid === null) {
				inputElement.addClass("TMDB-plugin__token-checking");
			} else if (isValid) {
				inputElement.addClass("TMDB-plugin__token-valid");
			} else {
				inputElement.addClass("TMDB-plugin__token-invalid");
			}
		}
	}

	/**
	 * Validate token with delay
	 */
	private async validateTokenWithDelay(
		token: string,
		inputElement: HTMLInputElement
	): Promise<void> {
		// Cancel previous validation
		if (this.validationTimeout) {
			clearTimeout(this.validationTimeout);
		}

		// Show checking state
		this.updateTokenValidationIndicator(inputElement, null);

		this.validationTimeout = setTimeout(async () => {
			try {
				const isValid = await this.TMDBProvider.validateToken(
					token
				);
				this.plugin.settings.apiTokenValid = isValid;
				await this.plugin.saveSettings();
				this.updateTokenValidationIndicator(inputElement, isValid);
			} catch (error) {

				console.error("Token validation error:", error);
				this.plugin.settings.apiTokenValid = false;
				await this.plugin.saveSettings();
				this.updateTokenValidationIndicator(inputElement, false);
			}
		}, 1500);
	}

	/**
	 * Create folder selection setting
	 */
	private createFolderSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		placeholder: string,
		currentValue: string,
		onValueChange: (value: string) => void
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSearch((cb) => {
				try {
					new FolderSuggest(this.app, cb.inputEl, onValueChange);
				} catch (error) {
					console.error("Error creating FolderSuggest:", error);
				}
				cb.setPlaceholder(placeholder)
					.setValue(currentValue)
					.onChange(onValueChange);
			});
	}

	/**
	 * Create template file selection setting
	 */
	private createTemplateSetting(
		containerEl: HTMLElement,
		name: string,
		desc: DocumentFragment,
		placeholder: string,
		currentValue: string,
		onValueChange: (value: string) => void
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addSearch((cb) => {
				try {
					new FileSuggest(this.app, cb.inputEl, onValueChange);
				} catch (error) {
					console.error("Error creating FileSuggest:", error);
				}
				cb.setPlaceholder(placeholder)
					.setValue(currentValue)
					.onChange(onValueChange);
			});
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.classList.add("obsidian-TMDB-plugin__settings");

		// Language setting (first setting)
		new Setting(containerEl)
			.setName(t("settings.language"))
			.setDesc(t("settings.languageDesc"))
			.addDropdown((dropdown) => {
				const languages = getSupportedLanguages();
				languages.forEach((lang) => {
					dropdown.addOption(lang.code, lang.name);
				});

				dropdown
					.setValue(this.plugin.settings.language)
					.onChange(async (value: SupportedLanguage) => {
						this.plugin.settings.language = value;
						setLanguage(value);
						await this.plugin.saveSettings();
						// Redraw settings with new language
						this.display();
					});
			});

		// API token setting
		const apiKeyDesc = document.createDocumentFragment();
		apiKeyDesc.createDiv({
			text: t("settings.apiTokenDesc"),
		});
		apiKeyDesc.createEl("a", {
			text: t("settings.getApiToken"),
			href: apiSite,
		});

		let tokenInputElement: HTMLInputElement;

		new Setting(containerEl)
			.setName(t("settings.apiToken"))
			.setDesc(apiKeyDesc)
			.addText((text) => {
				const textComponent = text
					.setPlaceholder(t("settings.enterToken"))
					.setValue(this.plugin.settings.apiToken)
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value.trim();
						this.plugin.settings.apiTokenValid = false;
						await this.plugin.saveSettings();

						// Automatic token validation with delay
						if (value.trim() !== "") {
							await this.validateTokenWithDelay(
								value.trim(),
								textComponent.inputEl
							);
						} else {
							// Cancel validation if token is empty and reset indicator
							if (this.validationTimeout) {
								clearTimeout(this.validationTimeout);
								this.validationTimeout = null;
							}
							this.updateTokenValidationIndicator(
								textComponent.inputEl,
								false
							);
						}
					});

				tokenInputElement = textComponent.inputEl;

				// Show current token status on load
				if (this.plugin.settings.apiToken.trim() !== "") {
					this.updateTokenValidationIndicator(
						textComponent.inputEl,
						this.plugin.settings.apiTokenValid
					);
				}

				return textComponent;
			})
			.addButton((button) =>
				button
					.setButtonText(t("settings.checkToken"))
					.setCta()
					.onClick(async () => {
						const token = this.plugin.settings.apiToken.trim();
						if (!token) {
							new Notice(t("settings.enterToken"));

							return;

						}

						button.setDisabled(true);
						button.setButtonText(t("settings.checking"));

						try {
							new Notice(t("settings.checking"));
							const isValid =
								await this.TMDBProvider.validateToken(
									token
								);
							this.plugin.settings.apiTokenValid = isValid;
							await this.plugin.saveSettings();

							this.updateTokenValidationIndicator(
								tokenInputElement,
								isValid
							);

							new Notice(
								isValid
									? t("settings.tokenValid")
									: t("settings.tokenInvalid")

							);
						} catch (error) {
							console.error(
								"Manual token validation error:",
								error
							);
							this.plugin.settings.apiTokenValid = false;
							await this.plugin.saveSettings();
							this.updateTokenValidationIndicator(
								tokenInputElement,
								false
							);
							new Notice(t("settings.tokenError"));
						} finally {
							button.setDisabled(false);
							button.setButtonText(t("settings.checkToken"));
						}
					})
			);


		// Images settings section
		new Setting(containerEl)
			.setName(t("settings.imagesHeading"))
			.setHeading();

		new Setting(containerEl)
			.setName(t("settings.saveImagesLocally"))
			.setDesc(t("settings.saveImagesLocallyDesc"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.saveImagesLocally)
					.onChange(async (value) => {
						this.plugin.settings.saveImagesLocally = value;
						await this.plugin.saveSettings();
						this.display(); // Redraw to show/hide dependent settings
					})
			);

		// Show additional settings only if local saving is enabled
		if (this.plugin.settings.saveImagesLocally) {
			this.createFolderSetting(
				containerEl,
				t("settings.imagesFolder"),
				t("settings.imagesFolderDesc"),
				t("settings.imagesFolderPlaceholder"),
				this.plugin.settings.imagesFolder,
				async (folder) => {
					this.plugin.settings.imagesFolder = folder;
					await this.plugin.saveSettings();
				}
			);

			new Setting(containerEl)
				.setName(t("settings.savePosterImage"))
				.setDesc(t("settings.savePosterImageDesc"))
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.savePosterImage)
						.onChange(async (value) => {
							this.plugin.settings.savePosterImage = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(t("settings.saveCoverImage"))
				.setDesc(t("settings.saveCoverImageDesc"))
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.saveCoverImage)
						.onChange(async (value) => {
							this.plugin.settings.saveCoverImage = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(t("settings.saveLogoImage"))
				.setDesc(t("settings.saveLogoImageDesc"))
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.saveLogoImage)
						.onChange(async (value) => {
							this.plugin.settings.saveLogoImage = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName(t("settings.imageFileNameFormat"))
				.setDesc(t("settings.imageFileNameFormatDesc"))
				.addText((text) =>
					text
						.setPlaceholder(t("settings.imageFileNameFormatPlaceholder"))
						.setValue(this.plugin.settings.imageFileNameFormat)
						.onChange(async (value) => {
							this.plugin.settings.imageFileNameFormat = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// Movies settings section
		new Setting(containerEl)
			.setName(t("settings.moviesHeading"))
			.setHeading();

		new Setting(containerEl)
			.setName(t("settings.movieFileName"))
			.setDesc(t("settings.movieFileNameDesc"))
			.addText((text) =>
				text
					.setPlaceholder(t("settings.movieFileNamePlaceholder"))
					.setValue(this.plugin.settings.movieFileNameFormat)
					.onChange(async (value) => {
						this.plugin.settings.movieFileNameFormat = value;
						await this.plugin.saveSettings();
					})
			);

		this.createFolderSetting(
			containerEl,
			t("settings.movieFileLocation"),
			t("settings.movieFileLocationDesc"),
			t("settings.movieFileLocationPlaceholder"),
			this.plugin.settings.movieFolder,
			async (folder) => {
				this.plugin.settings.movieFolder = folder;
				await this.plugin.saveSettings();
			}
		);

		const movieTemplateFileDesc = document.createDocumentFragment();
		movieTemplateFileDesc.createDiv({
			text: t("settings.movieTemplateFileDesc"),
		});
		movieTemplateFileDesc.createEl("a", {
			text: t("settings.exampleTemplate"),
			href: `${docUrl}#example-template`,
		});

		this.createTemplateSetting(
			containerEl,
			t("settings.movieTemplateFile"),
			movieTemplateFileDesc,
			t("settings.movieTemplateFilePlaceholder"),
			this.plugin.settings.movieTemplateFile,
			async (file) => {
				this.plugin.settings.movieTemplateFile = file;
				await this.plugin.saveSettings();
			}
		);

		// Series settings section
		new Setting(containerEl)
			.setName(t("settings.seriesHeading"))
			.setHeading();

		new Setting(containerEl)
			.setName(t("settings.seriesFileName"))
			.setDesc(t("settings.seriesFileNameDesc"))
			.addText((text) =>
				text
					.setPlaceholder(t("settings.seriesFileNamePlaceholder"))
					.setValue(this.plugin.settings.seriesFileNameFormat)
					.onChange(async (value) => {
						this.plugin.settings.seriesFileNameFormat = value;
						await this.plugin.saveSettings();
					})
			);

		this.createFolderSetting(
			containerEl,
			t("settings.seriesFileLocation"),
			t("settings.seriesFileLocationDesc"),
			t("settings.seriesFileLocationPlaceholder"),
			this.plugin.settings.seriesFolder,
			async (folder) => {
				this.plugin.settings.seriesFolder = folder;
				await this.plugin.saveSettings();
			}
		);

		const seriesTemplateFileDesc = document.createDocumentFragment();
		seriesTemplateFileDesc.createDiv({
			text: t("settings.seriesTemplateFileDesc"),
		});
		seriesTemplateFileDesc.createEl("a", {
			text: t("settings.exampleTemplate"),
			href: `${docUrl}#example-template`,
		});

		this.createTemplateSetting(
			containerEl,
			t("settings.seriesTemplateFile"),
			seriesTemplateFileDesc,
			t("settings.seriesTemplateFilePlaceholder"),
			this.plugin.settings.seriesTemplateFile,
			async (file) => {
				this.plugin.settings.seriesTemplateFile = file;
				await this.plugin.saveSettings();
			}
		);

		// People settings section
		new Setting(containerEl)
			.setName(t("settings.peopleHeading"))
			.setHeading();

		// Папка для актеров
		new Setting(containerEl)
			.setName(t("settings.actorsFileLocation"))
			.setDesc(t("settings.actorsFileLocationDesc"))
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl, (folder) => {
					this.plugin.settings.actorsPath = folder;
					this.plugin.saveSettings();
				});
				cb.setPlaceholder(t("settings.actorsFileLocationPlaceholder"))
					.setValue(this.plugin.settings.actorsPath)
					.onChange(async (newFolder) => {
						this.plugin.settings.actorsPath = newFolder;
						await this.plugin.saveSettings();
					});
			});

		// Папка для режиссеров
		new Setting(containerEl)
			.setName(t("settings.directorsFileLocation"))
			.setDesc(t("settings.directorsFileLocationDesc"))
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl, (folder) => {
					this.plugin.settings.directorsPath = folder;
					this.plugin.saveSettings();
				});
				cb.setPlaceholder(t("settings.directorsFileLocationPlaceholder"))
					.setValue(this.plugin.settings.directorsPath)
					.onChange(async (newFolder) => {
						this.plugin.settings.directorsPath = newFolder;
						await this.plugin.saveSettings();
					});
			});

		// Папка для сценаристов
		new Setting(containerEl)
			.setName(t("settings.writersFileLocation"))
			.setDesc(t("settings.writersFileLocationDesc"))
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl, (folder) => {
					this.plugin.settings.writersPath = folder;
					this.plugin.saveSettings();
				});
				cb.setPlaceholder(t("settings.writersFileLocationPlaceholder"))
					.setValue(this.plugin.settings.writersPath)
					.onChange(async (newFolder) => {
						this.plugin.settings.writersPath = newFolder;
						await this.plugin.saveSettings();
					});
			});

		// Папка для продюсеров
		new Setting(containerEl)
			.setName(t("settings.producersFileLocation"))
			.setDesc(t("settings.producersFileLocationDesc"))
			.addSearch((cb) => {
				new FolderSuggest(this.app, cb.inputEl, (folder) => {
					this.plugin.settings.producersPath = folder;
					this.plugin.saveSettings();
				});
				cb.setPlaceholder(t("settings.producersFileLocationPlaceholder"))
					.setValue(this.plugin.settings.producersPath)
					.onChange(async (newFolder) => {
						this.plugin.settings.producersPath = newFolder;
						await this.plugin.saveSettings();
					});
			});

	}
}
