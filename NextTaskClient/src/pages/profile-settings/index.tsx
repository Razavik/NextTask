import { FC, useState, useEffect } from "react";
import { useAuthStore, profileService } from "@entities/user";
import { User, Lock, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import styles from "./index.module.css";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";

interface ProfileForm {
	name: string;
	email: string;
}

interface PasswordForm {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

const ProfileSettings: FC = () => {
	const navigate = useNavigate();
	const user = useAuthStore((state) => state.user);

	const [profileForm, setProfileForm] = useState<ProfileForm>({
		name: user?.name || "",
		email: user?.email || "",
	});

	const [passwordForm, setPasswordForm] = useState<PasswordForm>({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});

	const [isProfileLoading, setIsProfileLoading] = useState(false);
	const [isPasswordLoading, setIsPasswordLoading] = useState(false);
	const [profileError, setProfileError] = useState<string | null>(null);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
	const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

	useEffect(() => {
		if (user) {
			setProfileForm({
				name: user.name || "",
				email: user.email || "",
			});
		}
	}, [user]);

	const handleProfileSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsProfileLoading(true);
		setProfileError(null);
		setProfileSuccess(null);

		try {
			await profileService.updateProfile({
				name: profileForm.name.trim(),
			});
			setProfileSuccess("Профиль успешно обновлен");
		} catch (error: any) {
			setProfileError(error.message || "Ошибка при обновлении профиля");
		} finally {
			setIsProfileLoading(false);
		}
	};

	const handlePasswordSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsPasswordLoading(true);
		setPasswordError(null);
		setPasswordSuccess(null);

		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			setPasswordError("Пароли не совпадают");
			setIsPasswordLoading(false);
			return;
		}

		if (passwordForm.newPassword.length < 6) {
			setPasswordError("Пароль должен содержать минимум 6 символов");
			setIsPasswordLoading(false);
			return;
		}

		try {
			await profileService.changePassword({
				current_password: passwordForm.currentPassword,
				new_password: passwordForm.newPassword,
			});
			setPasswordSuccess("Пароль успешно изменен");
			setPasswordForm({
				currentPassword: "",
				newPassword: "",
				confirmPassword: "",
			});
		} catch (error: any) {
			setPasswordError(error.message || "Ошибка при смене пароля");
		} finally {
			setIsPasswordLoading(false);
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<button
					onClick={() => navigate(-1)}
					className={styles.backBtn}
					title="Назад"
				>
					<ArrowLeft size={20} />
				</button>
				<h1 className={styles.title}>Настройки профиля</h1>
			</div>

			<div className={styles.content}>
				<div className={styles.section}>
					<div className={styles.sectionHeader}>
						<User size={20} />
						<h2 className={styles.sectionTitle}>
							Информация профиля
						</h2>
					</div>

					<form
						onSubmit={handleProfileSubmit}
						className={styles.form}
					>
						<div className={styles.field}>
							<label
								htmlFor="profile-name"
								className={styles.label}
							>
								Имя
							</label>
							<Input
								id="profile-name"
								type="text"
								value={profileForm.name}
								onChange={(e) =>
									setProfileForm((prev) => ({
										...prev,
										name: e.target.value,
									}))
								}
								placeholder="Введите ваше имя"
								required
							/>
						</div>

						<div className={styles.field}>
							<label
								htmlFor="profile-email"
								className={styles.label}
							>
								Email
							</label>
							<Input
								id="profile-email"
								type="email"
								value={profileForm.email}
								onChange={(e) =>
									setProfileForm((prev) => ({
										...prev,
										email: e.target.value,
									}))
								}
								placeholder="Введите ваш email"
								required
							/>
						</div>

						{profileError && (
							<div className={styles.error}>{profileError}</div>
						)}

						{profileSuccess && (
							<div className={styles.success}>
								{profileSuccess}
							</div>
						)}

						<Button
							type="submit"
							disabled={isProfileLoading}
							className={styles.submitBtn}
						>
							<Save size={16} />
							{isProfileLoading
								? "Сохранение..."
								: "Сохранить изменения"}
						</Button>
					</form>
				</div>

				<div className={styles.section}>
					<div className={styles.sectionHeader}>
						<Lock size={20} />
						<h2 className={styles.sectionTitle}>Смена пароля</h2>
					</div>

					<form
						onSubmit={handlePasswordSubmit}
						className={styles.form}
					>
						<div className={styles.field}>
							<label
								htmlFor="current-password"
								className={styles.label}
							>
								Текущий пароль
							</label>
							<Input
								id="current-password"
								type="password"
								value={passwordForm.currentPassword}
								onChange={(e) =>
									setPasswordForm((prev) => ({
										...prev,
										currentPassword: e.target.value,
									}))
								}
								placeholder="Введите текущий пароль"
								required
							/>
						</div>

						<div className={styles.field}>
							<label
								htmlFor="new-password"
								className={styles.label}
							>
								Новый пароль
							</label>
							<Input
								id="new-password"
								type="password"
								value={passwordForm.newPassword}
								onChange={(e) =>
									setPasswordForm((prev) => ({
										...prev,
										newPassword: e.target.value,
									}))
								}
								placeholder="Введите новый пароль"
								required
								minLength={6}
							/>
						</div>

						<div className={styles.field}>
							<label
								htmlFor="confirm-password"
								className={styles.label}
							>
								Подтвердите новый пароль
							</label>
							<Input
								id="confirm-password"
								type="password"
								value={passwordForm.confirmPassword}
								onChange={(e) =>
									setPasswordForm((prev) => ({
										...prev,
										confirmPassword: e.target.value,
									}))
								}
								placeholder="Повторите новый пароль"
								required
								minLength={6}
							/>
						</div>

						{passwordError && (
							<div className={styles.error}>{passwordError}</div>
						)}

						{passwordSuccess && (
							<div className={styles.success}>
								{passwordSuccess}
							</div>
						)}

						<Button
							type="submit"
							disabled={isPasswordLoading}
							className={styles.submitBtn}
						>
							<Lock size={16} />
							{isPasswordLoading
								? "Изменение..."
								: "Изменить пароль"}
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
};

export default ProfileSettings;
