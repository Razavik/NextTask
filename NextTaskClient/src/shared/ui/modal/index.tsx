import { FC, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./index.module.css";
import { X } from "lucide-react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	title?: string;
	maxWidth?: number | string;
	isCloseButton?: boolean;
}

const Modal: FC<ModalProps> = ({
	isOpen,
	onClose,
	children,
	title,
	maxWidth,
	isCloseButton = true,
}) => {
	const [isVisible, setIsVisible] = useState(isOpen);
	const [closing, setClosing] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	const mouseDownTarget = useRef<EventTarget | null>(null);

	// Следим за пропсом isOpen для контроля видимости и анимации закрытия
	useEffect(() => {
		if (isOpen) {
			setIsVisible(true);
			setClosing(false);

		} else if (isVisible) {
			setClosing(true);
			const timer = setTimeout(() => {
				setIsVisible(false);
				setClosing(false);

			}, 300);
			return () => clearTimeout(timer);
		}
	}, [isOpen, isVisible]);

	useEffect(() => {
		if (!isOpen) return;

		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};

		document.addEventListener("keydown", handleKey);

		return () => {
			document.removeEventListener("keydown", handleKey);
		};
	}, [isOpen, onClose, isVisible]);

	// Клик вне диалога — только если mousedown и mouseup были оба вне dialog
	const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		mouseDownTarget.current = e.target;
	};

	const handleOverlayMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
		if (
			mouseDownTarget.current === e.currentTarget &&
			e.target === e.currentTarget
		) {
			onClose();
		}
		mouseDownTarget.current = null;
	};

	if (!isVisible) return null;

	return createPortal(
		<div
			className={`${styles.overlay} ${closing ? styles.overlayHide : ""}`}
			onMouseDown={handleOverlayMouseDown}
			onMouseUp={handleOverlayMouseUp}
		>
			<div
				className={`${styles.modal} ${closing ? styles.modalHide : ""}`}
				style={
					maxWidth
						? {
								maxWidth:
									typeof maxWidth === "number"
										? `${maxWidth}px`
										: maxWidth,
						  }
						: undefined
				}
				ref={dialogRef}
				onMouseDown={(e) => e.stopPropagation()}
				onMouseUp={(e) => e.stopPropagation()}
			>
				{title && (
					<div className={styles.modalHeader}>
						<h2 className={styles.modalTitle}>{title}</h2>
						{isCloseButton && (
							<button
								onClick={onClose}
								className={styles.closeButton}
								aria-label="Close modal"
							>
								<X size={24} />
							</button>
						)}
					</div>
				)}
				{children}
			</div>
		</div>,
		document.querySelector("body") as HTMLElement
	);
};

export default Modal;
