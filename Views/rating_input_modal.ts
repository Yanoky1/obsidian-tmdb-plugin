import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

export class RatingInputModal extends Modal {
	private rating: number | null = null;
	private onChooseRating: (rating: number | string | null) => void;

	constructor(app: App, onChooseRating: (rating: number | string | null) => void) {
		super(app);
		this.onChooseRating = onChooseRating;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("TMDB-plugin__rating-input-modal");

		contentEl.createEl("h2", { text: t("modals.rateMovie") });

		// Create a container for the rating input
		const ratingContainer = contentEl.createDiv({ cls: "rating-input-container" });

		// Create rating input with numbers
		const numberRatingContainer = ratingContainer.createDiv({ cls: "number-rating" });

		// Create 10 numbered buttons for rating (0-10 scale)
		for (let i = 0; i <= 10; i++) {
			const numberButton = numberRatingContainer.createSpan({
				text: i.toString(),
				cls: "number-button",
				attr: { "data-rating": i.toString() }
			});

			numberButton.style.fontSize = "1rem";
			numberButton.style.cursor = "pointer";
			numberButton.style.margin = "0 1px";
			numberButton.style.padding = "6px 8px";
			numberButton.style.border = "2px solid #d1d5db";
			numberButton.style.borderRadius = "4px";
			numberButton.style.display = "inline-block";
			numberButton.style.textAlign = "center";
			numberButton.style.width = "30px";
			numberButton.style.height = "30px";
			numberButton.style.lineHeight = "18px";
			numberButton.style.boxSizing = "border-box";

			numberButton.addEventListener("click", () => {
				this.rating = i;
				// Update number display
				this.updateNumberDisplay(i);
			});

			numberButton.addEventListener("mouseover", () => {
				this.highlightNumbers(i);
			});

			numberButton.addEventListener("mouseout", () => {
				this.resetNumberDisplay();
				if (this.rating !== null) {
					this.updateNumberDisplay(this.rating);
				}
			});
		}

		// Create numeric input as alternative
		const numericInputContainer = ratingContainer.createDiv({ cls: "numeric-input" });
		numericInputContainer.createEl("label", { text: `${t("modals.ratingValue")}: ` });

		const numericInput = numericInputContainer.createEl("input", {
			type: "number",
			placeholder: t("modals.enterRatingPlaceholder")
		});

		// Set attributes separately to avoid TypeScript error
		numericInput.setAttribute("min", "0");
		numericInput.setAttribute("max", "10");
		numericInput.setAttribute("step", "0.5");

		numericInput.addEventListener("input", (e) => {
			const value = parseFloat((e.target as HTMLInputElement).value);
			if (!isNaN(value) && value >= 0 && value <= 10) {
				this.rating = value;
				// Update number display based on numeric input
				this.updateNumberDisplay(Math.round(value));
			} else if ((e.target as HTMLInputElement).value === "") {
				this.rating = null;
				this.resetNumberDisplay();
			}
		});

		// Add buttons
		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

		new Setting(buttonContainer)
			.addButton((btn) =>
				btn
					.setButtonText(t("common.ok"))
					.setCta()
					.onClick(() => {
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText(t("common.skip"))
					.onClick(() => {
						this.rating = null; // Set rating to null to indicate skip
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText(t("common.cancel"))
					.onClick(() => {
						this.rating = null;
						this.close();
					})
			);
	}

	private updateNumberDisplay(selectedRating: number) {
		const numberButtons = this.contentEl.querySelectorAll(".number-button");
		numberButtons.forEach((button) => {
			const buttonElement = button as HTMLElement;
			const ratingValue = parseInt(buttonElement.getAttribute("data-rating") || "0");
			if (ratingValue === selectedRating) {
				buttonElement.style.backgroundColor = "#3b82f6"; // Blue for selected
				buttonElement.style.color = "white";
				buttonElement.style.borderColor = "#3b82f6";
			} else {
				buttonElement.style.backgroundColor = "";
				buttonElement.style.color = "";
				buttonElement.style.borderColor = "#d1d5db";
			}
		});
	}

	private highlightNumbers(toRating: number) {
		const numberButtons = this.contentEl.querySelectorAll(".number-button");
		numberButtons.forEach((button) => {
			const buttonElement = button as HTMLElement;
			const ratingValue = parseInt(buttonElement.getAttribute("data-rating") || "0");
			if (ratingValue <= toRating) {
				buttonElement.style.backgroundColor = "#93c5fd"; // Light blue for hover effect
				buttonElement.style.color = "black";
			} else {
				buttonElement.style.backgroundColor = "";
				buttonElement.style.color = "";
			}
		});
	}

	private resetNumberDisplay() {
		const numberButtons = this.contentEl.querySelectorAll(".number-button");
		numberButtons.forEach((button) => {
			const buttonElement = button as HTMLElement;
			const ratingValue = parseInt(buttonElement.getAttribute("data-rating") || "0");
			if (this.rating !== null && ratingValue === this.rating) {
				buttonElement.style.backgroundColor = "#3b82f6"; // Blue for selected
				buttonElement.style.color = "white";
				buttonElement.style.borderColor = "#3b82f6";
			} else {
				buttonElement.style.backgroundColor = "";
				buttonElement.style.color = "";
				buttonElement.style.borderColor = "#d1d5db";
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Return empty string if rating is null (indicating skip was pressed)
		this.onChooseRating(this.rating === null ? "" : this.rating);
	}
}
