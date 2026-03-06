import { FC, useState } from "react";
import styles from "../index.module.css";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import { PasswordChangeRequest } from "@entities/user";

interface ProfileSecurityProps {
	loading: boolean;
	handlePasswordChange: (
		e: React.FormEvent,
		passwordData: PasswordChangeRequest,
	) => Promise<void>;
}

const ProfileSecurity: FC<ProfileSecurityProps> = ({
	loading,
	handlePasswordChange,
}) => {
	const [passwords, setPasswords] = useState({
		current: "",
		new: "",
		confirm: "",
	});

	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Валидация
		if (!passwords.current || !passwords.new || !passwords.confirm) {
			setError("Все поля обязательны для заполнения");
			return;
		}

		if (passwords.new !== passwords.confirm) {
			setError("Новые пароли не совпадают");
			return;
		}

		if (passwords.new.length < 6) {
			setError("Новый пароль должен содержать минимум 6 символов");
			return;
		}

		try {
			await handlePasswordChange(e, {
				current_password: passwords.current,
				new_password: passwords.new,
			});
			// Очищаем форму после успешной смены
			setPasswords({ current: "", new: "", confirm: "" });
		} catch (error) {
			// Ошибка уже обработана в handlePasswordChange через toast
		}
	};

	return (
		<>
			<h3 className={styles.titleSection}>Изменение пароля</h3>
			<form onSubmit={handleSubmit}>
				<div className={styles.card}>
					{error && <div className={styles.error}>{error}</div>}
					<div className={styles.formGroup}>
						<label className={styles.formLabel}>
							Текущий пароль
						</label>
						<Input
							type="password"
							value={passwords.current}
							onChange={(e) =>
								setPasswords((prev) => ({
									...prev,
									current: e.target.value,
								}))
							}
							required
						/>
					</div>
					<div className={styles.formGroup}>
						<label className={styles.formLabel}>Новый пароль</label>
						<Input
							type="password"
							value={passwords.new}
							onChange={(e) =>
								setPasswords((prev) => ({
									...prev,
									new: e.target.value,
								}))
							}
							minLength={6}
							required
						/>
					</div>
					<div className={styles.formGroup}>
						<label className={styles.formLabel}>
							Подтвердите новый пароль
						</label>
						<Input
							type="password"
							value={passwords.confirm}
							onChange={(e) =>
								setPasswords((prev) => ({
									...prev,
									confirm: e.target.value,
								}))
							}
							minLength={6}
							required
						/>
					</div>
					<div className={styles.buttonGroup}>
						<Button type="submit" disabled={loading}>
							{loading ? "Изменение..." : "Изменить пароль"}
						</Button>
					</div>
				</div>
			</form>
		</>
	);
};

export default ProfileSecurity;
