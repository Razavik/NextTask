import { FC } from "react";
import styles from "../index.module.css";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import AvatarUploader from "@shared/ui/avatar-uploader";

interface ProfileMainInfoProps {
	profile: {
		avatar: string;
		role: string;
		position: string;
		name: string;
		email: string;
	};
	avatarPreview?: string;
	avatarUploading: boolean;
	loading: boolean;
	handleProfileUpdate: (e: React.FormEvent) => void;
	onAvatarSelected: (file: File) => void;
	setProfile: (profile: any) => void;
}

const ProfileMainInfo: FC<ProfileMainInfoProps> = ({
	profile,
	avatarPreview,
	avatarUploading,
	loading,
	handleProfileUpdate,
	onAvatarSelected,
	setProfile,
}) => {
	return (
		<div className={styles.profileGrid}>
			<div className={styles.card}>
				<div className={styles.avatarSection}>
					<AvatarUploader
						avatarUrl={avatarPreview ?? profile.avatar}
						fullName={profile.name}
						onUpload={onAvatarSelected}
						isUploading={avatarUploading}
					/>
					<div className={styles.userRole}>{profile.role}</div>
				</div>
			</div>
			<div className={styles.card} style={{ flex: 1 }}>
				<form onSubmit={handleProfileUpdate}>
					<div className={styles.formRow}>
						<div className={styles.formCol}>
							<div className={styles.formGroup}>
								<label
									htmlFor="name"
									className={styles.formLabel}
								>
									Полное имя
								</label>
								<Input
									id="name"
									type="text"
									value={profile.name}
									onChange={(
										e: React.ChangeEvent<HTMLInputElement>,
									) =>
										setProfile((prev: any) => ({
											...prev,
											name: e.target.value,
										}))
									}
								/>
							</div>
							<div className={styles.formGroup}>
								<label
									htmlFor="position"
									className={styles.formLabel}
								>
									Должность
								</label>
								<Input
									id="position"
									type="text"
									placeholder="Например: Frontend-разработчик"
									value={profile.position}
									onChange={(
										e: React.ChangeEvent<HTMLInputElement>,
									) =>
										setProfile((prev: any) => ({
											...prev,
											position: e.target.value,
										}))
									}
								/>
							</div>
							<div className={styles.formGroup}>
								<label
									htmlFor="email"
									className={styles.formLabel}
								>
									Email
								</label>
								<Input
									id="email"
									type="email"
									value={profile.email}
									disabled
								/>
							</div>
						</div>
					</div>
					<div className={styles.buttonGroup}>
						<Button
							type="submit"
							className={styles.primaryButton}
							disabled={loading}
						>
							Сохранить изменения
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default ProfileMainInfo;
