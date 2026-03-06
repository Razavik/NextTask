import { FC, useRef, ChangeEvent } from "react";
import { Camera } from "lucide-react";
import styles from "./index.module.css";
import Button from "@shared/ui/button";

interface AvatarUploaderProps {
	avatarUrl?: string;
	fullName: string;
	onUpload: (file: File) => void;
	isUploading?: boolean;
}

const AvatarUploader: FC<AvatarUploaderProps> = ({ avatarUrl, fullName, onUpload, isUploading }) => {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const initials = fullName?.trim()?.charAt(0).toUpperCase() || "?";

	const handleSelectClick = () => {
		if (isUploading) return;
		inputRef.current?.click();
	};

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			await Promise.resolve(onUpload(file));
		}
		// очищаем значение чтобы одно и то же можно было выбрать повторно
		event.target.value = "";
	};

	return (
		<div className={styles.root}>
			<div className={styles.avatarWrapper}>
				{avatarUrl ? (
					<img src={avatarUrl} alt="Аватар" className={styles.avatarImage} />
				) : (
					<span className={styles.avatarFallback}>{initials}</span>
				)}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={handleSelectClick}
				className={styles.actionButton}
				disabled={isUploading}
			>
				<Camera size={16} aria-hidden />
				{isUploading ? "Загрузка..." : "Изменить"}
			</Button>
			<input
				type="file"
				accept="image/png,image/jpeg,image/jpg,image/webp"
				ref={inputRef}
				onChange={handleFileChange}
				className={styles.fileInput}
				aria-label="Загрузить новый аватар"
				disabled={isUploading}
			/>
		</div>
	);
};

export default AvatarUploader;
