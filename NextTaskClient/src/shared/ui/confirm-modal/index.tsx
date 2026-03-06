import { FC, useState, useEffect } from "react";
import styles from "./index.module.css";
import Modal from "@shared/ui/modal";

interface ConfirmModalProps {
	open: boolean;
	title?: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "default" | "danger";
	loading?: boolean;
	// Если требуется ввести текст для подтверждения (например, имя workspace)
	requireMatchText?: string;
	matchLabel?: string;
	matchPlaceholder?: string;
	onConfirm: () => void | Promise<void>;
	onCancel: () => void;
}

const ConfirmModal: FC<ConfirmModalProps> = ({
	open,
	title = "Подтвердите действие",
	message,
	confirmLabel = "Подтвердить",
	cancelLabel = "Отмена",
	variant = "default",
	loading = false,
	requireMatchText,
	matchLabel,
	matchPlaceholder,
	onConfirm,
	onCancel,
}) => {
	if (!open) return null;
	const [typed, setTyped] = useState("");

	useEffect(() => {
		if (!open) setTyped("");
	}, [open]);

	return (
		<Modal isOpen={open} onClose={onCancel}>
			{title && <h3 className={styles.title}>{title}</h3>}
			{message && <p className={styles.message}>{message}</p>}
			{requireMatchText !== undefined && (
				<div className={styles.matchBlock}>
					{matchLabel && <label className={styles.matchLabel}>{matchLabel}</label>}
					<input
						className={styles.matchInput}
						type="text"
						placeholder={matchPlaceholder}
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
					/>
				</div>
			)}
			<div className={styles.footer}>
				<button
					type="button"
					className={styles.cancelBtn}
					onClick={onCancel}
					disabled={loading}
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					className={`${styles.confirmBtn} ${variant === "danger" ? styles.danger : ""}`}
					onClick={onConfirm}
					disabled={
						loading || (requireMatchText !== undefined && typed !== requireMatchText)
					}
				>
					{loading ? "Выполняется..." : confirmLabel}
				</button>
			</div>
		</Modal>
	);
};

export default ConfirmModal;
