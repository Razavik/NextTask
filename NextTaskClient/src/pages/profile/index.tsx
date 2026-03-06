import { FC, useState, useEffect, useMemo, useRef } from "react";
import { useAuthStore, profileService } from "@entities/user";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./index.module.css";
import ProfileMainInfo from "./components/ProfileMainInfo";
import ProfileSecurity from "./components/ProfileSecurity";
import Loader from "@shared/ui/loader";
import WorkspaceHeader from "@widgets/workspace-header/ui";
import TabNavigation from "@shared/ui/tab-navigation";
import { useMyInvitesCount } from "@features/invites";
import { useToast } from "@shared/lib/hooks/useToast";
import { ProfileUpdateRequest, PasswordChangeRequest } from "@entities/user";
import { User, Shield, Link, Mail } from "lucide-react";
import ProfileInvites from "./components/profile-invites";
import glass from "@shared/styles/glass.module.css";

type ActiveTab = "profile" | "security" | "invites" | "connections";

interface UserProfile {
	name: string;
	email: string;
	avatar: string;
	role: string;
	position: string;
}

const Profile: FC = () => {
	const navigate = useNavigate();
	const { tab } = useParams<{ tab?: string }>();

	const urlToTab = (value?: string | null): ActiveTab => {
		if (!value || value === "general") return "profile";
		if (
			value === "security" ||
			value === "invites" ||
			value === "connections"
		) {
			return value as ActiveTab;
		}
		return "profile";
	};

	const [activeTab, setActiveTab] = useState<ActiveTab>(() => urlToTab(tab));
	const [loading, setLoading] = useState(true);
	const [avatarUploading, setAvatarUploading] = useState(false);
	const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
		undefined,
	);
	const previewUrlRef = useRef<string | null>(null);
	const toast = useToast();
	const { user: currentUser, updateUserProfile } = useAuthStore();

	const [profile, setProfile] = useState<UserProfile>({
		name: "",
		email: "",
		avatar: "",
		role: "Пользователь",
		position: "",
	});

	const { count: invitesCount } = useMyInvitesCount({
		enabled: !!currentUser,
	});

	const tabs = useMemo(
		() => [
			{
				id: "profile" as ActiveTab,
				label: "Профиль",
				icon: <User size={18} />,
			},
			{
				id: "security" as ActiveTab,
				label: "Безопасность",
				icon: <Shield size={18} />,
			},
			{
				id: "invites" as ActiveTab,
				label: "Приглашения",
				icon: <Mail size={18} />,
				badge: invitesCount,
			},
			{
				id: "connections" as ActiveTab,
				label: "Подключения",
				icon: <Link size={18} />,
				disabled: true,
			},
		],
		[invitesCount],
	);

	useEffect(() => {
		setActiveTab(urlToTab(tab));
	}, [tab]);

	useEffect(() => {
		const loadProfile = async () => {
			if (!currentUser) {
				setLoading(false);
				return;
			}

			try {
				const profileData = await profileService.getProfile();
				setProfile({
					name: profileData.name || "",
					email: profileData.email,
					avatar: profileData.avatar || "",
					role: "Пользователь",
					position: profileData.position || "",
				});
			} catch (error) {
				console.error("Ошибка загрузки профиля:", error);
				toast.error(
					"Ошибка загрузки",
					"Не удалось загрузить данные профиля",
				);
				setProfile((prev) => ({
					...prev,
					name: currentUser?.name || "",
					email: currentUser?.email ?? prev.email,
					position: currentUser?.position || "",
				}));
				if (currentUser) {
					updateUserProfile({
						name: currentUser.name,
						position: currentUser.position,
					});
				}
			} finally {
				setLoading(false);
			}
		};

		loadProfile();
	}, [currentUser, updateUserProfile]);

	useEffect(() => {
		return () => {
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
			}
		};
	}, []);

	const handleAvatarSelected = async (file: File) => {
		if (previewUrlRef.current) {
			URL.revokeObjectURL(previewUrlRef.current);
		}
		const url = URL.createObjectURL(file);
		previewUrlRef.current = url;
		setAvatarPreview(url);
		setAvatarUploading(true);
		try {
			const avatarResponse = await profileService.uploadAvatar(file);
			setProfile((prev) => ({
				...prev,
				avatar: avatarResponse.avatar || prev.avatar,
			}));
			updateUserProfile({
				avatar: avatarResponse.avatar,
			});
			toast.success("Аватар обновлён", "Новый аватар успешно загружен");
		} catch (error) {
			console.error("Ошибка загрузки аватара:", error);
			toast.error(
				"Не удалось загрузить аватар",
				"Попробуйте ещё раз позже",
			);
		} finally {
			setAvatarUploading(false);
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
				previewUrlRef.current = null;
			}
			setAvatarPreview(undefined);
		}
	};

	const handleProfileUpdate = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const updateData: ProfileUpdateRequest = {
				name: profile.name || undefined,
				position: profile.position || undefined,
			};

			const updatedProfile =
				await profileService.updateProfile(updateData);

			setProfile((prev) => ({
				...prev,
				name: updatedProfile.name || "",
				position: updatedProfile.position || "",
				avatar: updatedProfile.avatar || prev.avatar,
			}));
			updateUserProfile(updatedProfile);
			toast.success("Профиль обновлён", "Ваши данные успешно сохранены");
		} catch (error) {
			console.error("Ошибка обновления профиля:", error);
			toast.error(
				"Ошибка обновления",
				"Не удалось сохранить изменения. Попробуйте ещё раз.",
			);
		} finally {
			setLoading(false);
		}
	};

	const handlePasswordChange = async (
		e: React.FormEvent,
		passwordData: PasswordChangeRequest,
	) => {
		e.preventDefault();
		setLoading(true);

		try {
			await profileService.changePassword(passwordData);
			toast.success("Успешно!", "Пароль успешно изменён.");
		} catch (error) {
			console.error("Ошибка смены пароля:", error);
			toast.error(
				"Ошибка смены пароля",
				"Не удалось изменить пароль. Проверьте правильность текущего пароля.",
			);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className={styles.container}>
				<Loader />
			</div>
		);
	}

	const renderTabContent = () => {
		switch (activeTab) {
			case "profile":
				return (
					<ProfileMainInfo
						profile={profile}
						avatarPreview={avatarPreview}
						avatarUploading={avatarUploading}
						loading={loading}
						handleProfileUpdate={handleProfileUpdate}
						onAvatarSelected={handleAvatarSelected}
						setProfile={setProfile}
					/>
				);
			case "security":
				return (
					<ProfileSecurity
						loading={loading}
						handlePasswordChange={handlePasswordChange}
					/>
				);
			case "invites":
				return <ProfileInvites />;
			case "connections":
				return (
					<div className={styles.comingSoon}>
						<Link size={48} className={styles.comingSoonIcon} />
						<p>Раздел в разработке</p>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className={styles.container}>
			<WorkspaceHeader
				title="Настройки профиля"
				onBack={() => navigate(`/workspaces`)}
				backTitle="назад"
			/>

			<TabNavigation
				tabs={tabs}
				activeTab={activeTab}
				onTabChange={(tabId) => {
					const next = tabId as ActiveTab;
					setActiveTab(next);
					const urlSegment = next === "profile" ? "general" : next;
					navigate(`/profile/${urlSegment}`, { replace: false });
				}}
			/>

			<section className={`${styles.content} ${glass.glassSurface}`}>
				{renderTabContent()}
			</section>
		</div>
	);
};

export default Profile;
