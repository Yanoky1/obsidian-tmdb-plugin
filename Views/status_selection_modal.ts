import { App, Modal, Setting, setIcon } from "obsidian"; // Импортируем setIcon
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

		const optionsContainer = contentEl.createDiv({ cls: "status-options-container" });

		this.statusOptions.forEach((status) => {
			const statusIcons: { [key: string]: string } = {
				[t("status.willWatch")]: "bookmark",
				[t("status.haveWatched")]: "check-circle",
				[t("status.watching")]: "eye",
				[t("status.dropped")]: "x-circle"
			};

			const iconName = statusIcons[status] || "star";

			const setting = new Setting(optionsContainer)
				.setName(status);

			// Создаем span с классом status-icon
			const iconEl = setting.nameEl.createSpan({ cls: "status-icon" });
			setIcon(iconEl, iconName);
			// Удалено: iconEl.style.marginRight (теперь управляется через CSS gap)
			setting.nameEl.prepend(iconEl);

			setting.settingEl.style.cursor = "pointer";
			setting.settingEl.onclick = () => {
				this.selectedStatus = status;
				if (status === t("status.haveWatched")) {
					this.close();
					setTimeout(() => {
						new RatingInputModal(this.app, (rating) => {
							this.onChooseStatus(this.selectedStatus, rating);
						}).open();
					}, 100);
				} else {
					this.close();
				}
			};
		});

		// Добавляем иконку для кнопки Skip (Пропустить)
		const skipSetting = new Setting(contentEl)
			.setName(t("status.skip"))
			.setDesc(`${t("status.useDefault")} (${t("status.defaultStatus")})`);

		// ТЕПЕРЬ ТУТ ТОЖЕ ГЕНЕРИРУЕТСЯ КЛАСС status-icon
		const skipIconEl = skipSetting.nameEl.createSpan({ cls: "status-icon" });
		setIcon(skipIconEl, "forward");
		// Удалено: skipIconEl.style.marginRight
		skipSetting.nameEl.prepend(skipIconEl);

		skipSetting.settingEl.style.cursor = "pointer";
		skipSetting.settingEl.onclick = () => {
			this.selectedStatus = null;
			this.close();
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		if (this.selectedStatus !== t("status.haveWatched")) {
			this.onChooseStatus(this.selectedStatus, null);
		}
	}
}