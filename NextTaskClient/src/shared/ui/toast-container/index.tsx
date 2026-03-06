import { useEffect, FC } from "react";
import { useToastStore, type Toast } from "@shared/model/toastStore";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import styles from "./index.module.css";

const ToastItem: FC<{ toast: Toast }> = ({ toast }) => {
	const startRemoveToast = useToastStore((state) => state.startRemoveToast);
	const removeToast = useToastStore((state) => state.removeToast);

	useEffect(() => {
		if (toast.duration && toast.duration > 0 && !toast.isRemoving) {
			const timer = setTimeout(() => {
				startRemoveToast(toast.id);
			}, toast.duration);
			return () => clearTimeout(timer);
		}
	}, [toast.id, toast.duration, toast.isRemoving, startRemoveToast]);

	useEffect(() => {
		if (toast.isRemoving) {
			const timer = setTimeout(() => {
				removeToast(toast.id);
			}, 300); // Длительность анимации выхода
			return () => clearTimeout(timer);
		}
	}, [toast.id, toast.isRemoving, removeToast]);

	const handleClose = () => {
		startRemoveToast(toast.id);
	};

	const getIcon = () => {
		switch (toast.type) {
			case "success":
				return <CheckCircle size={20} />;
			case "error":
				return <XCircle size={20} />;
			case "warning":
				return <AlertTriangle size={20} />;
			case "info":
				return <Info size={20} />;
			case "message":
				return toast.avatar ? (
					<img
						src={toast.avatar}
						alt=""
						style={{
							width: 40,
							height: 40,
							borderRadius: "50%",
							objectFit: "cover",
						}}
					/>
				) : (
					<div
						style={{
							width: 40,
							height: 40,
							borderRadius: "50%",
							background: "var(--brand-gradient)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
							fontWeight: 600,
						}}
					>
						{toast.title.charAt(0).toUpperCase()}
					</div>
				);
			default:
				return <Info size={20} />;
		}
	};

	const handleClick = () => {
		if (toast.onClick) {
			toast.onClick();
			handleClose();
		}
	};

	return (
		<div
			className={`${styles.toast} ${styles[toast.type]} ${toast.isRemoving ? styles.removing : ""}`}
			onClick={toast.type === "message" ? handleClick : undefined}
			style={{
				cursor:
					toast.type === "message" && toast.onClick
						? "pointer"
						: "default",
			}}
		>
			<div className={styles.toastIcon}>{getIcon()}</div>
			<div className={styles.toastContent}>
				<div className={styles.toastTitle}>{toast.title}</div>
				{toast.message && (
					<div className={styles.toastMessage}>{toast.message}</div>
				)}
			</div>
			<button
				className={styles.toastClose}
				onClick={(e) => {
					e.stopPropagation();
					handleClose();
				}}
				aria-label="Закрыть уведомление"
			>
				<X size={16} />
			</button>
		</div>
	);
};

const ToastContainer: React.FC = () => {
	const toasts = useToastStore((state) => state.toasts);

	if (toasts.length === 0) {
		return null;
	}

	return (
		<div className={styles.toastContainer}>
			{toasts.map((toast) => (
				<ToastItem key={toast.id} toast={toast} />
			))}
		</div>
	);
};

export default ToastContainer;
