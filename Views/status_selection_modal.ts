import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";
import { RatingInputModal } from "./rating_input_modal";

export class StatusSelectionModal extends Modal {
	private selectedStatus: string | null = null;
	private onChooseStatus: (status: string | null, rating?: number | string | null) => void;

	constructor(app: App, private statusOptions: string[], onChooseStatus: (status: string | null, rating?: number | string | null) => void) {
		super(app);
		this.onChooseStatus = onChooseStatus;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("TMDB-plugin__status-selection-modal");

		contentEl.createEl("h2", { text: t("status.selectStatus") });

		// Create a container for the status options
		const optionsContainer = contentEl.createDiv({ cls: "status-options-container" });

		// Add each status option as clickable text with emojis
		this.statusOptions.forEach((status) => {
			// Map status to emoji
			const statusEmojis: { [key: string]: string } = {
				[t("status.willWatch")]: "🎬",
				[t("status.haveWatched")]: "✅",
				[t("status.watching")]: "📺",
				[t("status.dropped")]: "⏸️"
			};

			const emoji = statusEmojis[status] || "⭐"; // Default emoji if not found
			const displayName = `${emoji} ${status}`;

			const setting = new Setting(optionsContainer)
				.setName(displayName);

			// Make the entire setting clickable
			setting.settingEl.style.cursor = "pointer";
			setting.settingEl.onclick = () => {
				this.selectedStatus = status; // Store the text without emoji

				// If the selected status is "haveWatched", show rating input
				if (status === t("status.haveWatched")) {
					// Close this modal and open the rating input modal
					this.close();

					// Open rating input modal after a small delay to allow this modal to close
					setTimeout(() => {
						new RatingInputModal(this.app, (rating) => {
							this.onChooseStatus(this.selectedStatus, rating);
						}).open();
					}, 100);
				} else {
					// For other statuses, just close the modal
					this.close();
				}
			};
		});

		// Add a "Skip" option
		const skipSetting = new Setting(contentEl)
			.setName(t("status.skip"))
			.setDesc(`${t("status.useDefault")} (${t("status.defaultStatus")})`);

		skipSetting.settingEl.style.cursor = "pointer";
		skipSetting.settingEl.onclick = () => {
			this.selectedStatus = null; // Will use default
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();

		// If the selected status is not "haveWatched", call the callback directly
		if (this.selectedStatus !== t("status.haveWatched")) {
			this.onChooseStatus(this.selectedStatus, null);
		}
		// If it is "haveWatched", the rating modal will handle the callback
	}
}