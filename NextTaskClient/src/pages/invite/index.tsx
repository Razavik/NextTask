import { FC, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { acceptInvite, validateInvite } from "@features/invites";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@entities/user";
import Button from "@shared/ui/button";
import styles from "./index.module.css";
// ... (удален RootState)

interface Workspace {
	id: number;
	name: string;
	description?: string;
	tasksCount: number;
	usersCount: number;
	owner: {
		name: string;
		email: string;
	};
}

interface InviteData {
	workspace: Workspace;
	inviter: {
		name: string;
		email: string;
	};
	expiresAt: string;
	isExpired: boolean;
}

const Invite: FC = () => {
	// Получаем токен приглашения из URL
	const { token } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	// Состояния компонента
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [inviteData, setInviteData] = useState<InviteData | null>(null);

	// Текущий пользователь из Zustand
	const currentUser = useAuthStore((state) => state.user);

	// Функция для проверки токена приглашения
	useEffect(() => {
		const checkInvite = async () => {
			if (!token) {
				setError("Токен приглашения не найден");
				setLoading(false);
				return;
			}

			try {
				setLoading(true);
				const data: any = await validateInvite(token);

				setInviteData({
					workspace: {
						id: data.workspace.id,
						name: data.workspace.name,
						description: data.workspace.description,
						tasksCount: data.workspace.tasks_count || 0,
						usersCount: data.workspace.users_count || 0,
						owner: {
							name: data.workspace.owner?.name || "Неизвестно",
							email: data.workspace.owner?.email || "",
						},
					},
					inviter: {
						name: data.inviter.name,
						email: data.inviter.email,
					},
					expiresAt: data.expires_at,
					isExpired: false,
				});
			} catch (err: any) {
				console.error("Ошибка при проверке приглашения:", err);
				const status = err?.response?.status;
				const errorData = err?.response?.data;

				if (status === 404) {
					setError("Приглашение не найдено или недействительно");
				} else if (status === 400) {
					if (errorData?.detail?.includes("expired")) {
						const expiredData = errorData.invite_data;
						if (expiredData) {
							setInviteData({
								workspace: expiredData.workspace,
								inviter: expiredData.inviter,
								expiresAt: expiredData.expires_at,
								isExpired: true,
							});
						} else {
							setError("Срок действия приглашения истек");
						}
					} else {
						setError(
							errorData?.detail || "Приглашение недействительно",
						);
					}
				} else {
					setError("Ошибка при проверке приглашения");
				}
			} finally {
				setLoading(false);
			}
		};

		checkInvite();
	}, [token]);

	// Обработчик принятия приглашения
	const handleAcceptInvite = async () => {
		try {
			setLoading(true);
			if (!token) return;
			try {
				const { workspace_id } = await acceptInvite(token);
				// Обновляем кэш рабочих пространств
				queryClient.invalidateQueries({ queryKey: ["workspaces"] });
				setSuccess(
					"Приглашение принято! Перенаправляем в рабочее пространство...",
				);
				// Навигация
				setTimeout(
					() => navigate(`/workspaces/workspace/${workspace_id}`),
					1000,
				);
			} catch (e) {
				setError(
					"Ошибка при принятии приглашения. Возможно, ссылка недействительна.",
				);
			} finally {
				setLoading(false);
			}
		} catch (err) {
			setError(
				"Ошибка при принятии приглашения. Пожалуйста, попробуйте позже.",
			);
			setLoading(false);
		}
	};

	// Обработчик отклонения приглашения
	const handleDeclineInvite = async () => {
		try {
			setLoading(true);

			// TODO: Здесь должен быть API-запрос для отклонения приглашения
			// const response = await api.post(`/invites/${token}/decline`);

			// Имитация запроса
			setTimeout(() => {
				setSuccess(
					"Приглашение отклонено. Перенаправляем на главную страницу...",
				);

				// Перенаправляем пользователя на главную страницу после отклонения приглашения
				setTimeout(() => {
					navigate("/");
				}, 2000);
			}, 1000);
		} catch (err) {
			setError(
				"Ошибка при отклонении приглашения. Пожалуйста, попробуйте позже.",
			);
			setLoading(false);
		}
	};

	// Отображение загрузки
	if (loading && !success) {
		return (
			<div className={styles.container}>
				<div className={styles.loadingContainer}>
					<div>Загрузка информации о приглашении...</div>
					<div className={styles.loadingText}>
						Это может занять несколько секунд
					</div>
				</div>
			</div>
		);
	}

	// Отображение ошибки
	if (error) {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<h2 className={styles.title}>Ошибка</h2>
					<div className={styles.error}>{error}</div>
					<Link to="/" className={styles.returnLink}>
						Вернуться на главную
					</Link>
				</div>
			</div>
		);
	}

	// Отображение успешного сообщения
	if (success) {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<h2 className={styles.title}>Обработка приглашения</h2>
					<div className={styles.success}>{success}</div>
				</div>
			</div>
		);
	}

	// Отображение истекшего приглашения
	if (inviteData?.isExpired) {
		return (
			<div className={styles.container}>
				<div className={styles.card}>
					<h2 className={styles.title}>Приглашение истекло</h2>
					<div className={styles.expired}>
						<div className={styles.expiredIcon}>⏱</div>
						<p>
							Срок действия этого приглашения истек{" "}
							{new Date(inviteData.expiresAt).toLocaleString(
								"ru-RU",
							)}
							.
						</p>
						<p>
							Пожалуйста, свяжитесь с {inviteData.inviter.name}{" "}
							для получения нового приглашения.
						</p>
					</div>
					<Link to="/" className={styles.returnLink}>
						Вернуться на главную
					</Link>
				</div>
			</div>
		);
	}

	// Основной интерфейс приглашения
	return (
		<div className={styles.container}>
			<div className={styles.card}>
				<h2 className={styles.title}>
					Приглашение в рабочее пространство
				</h2>
				<p className={styles.subtitle}>
					{currentUser ? `${currentUser.name}, вас` : "Вас"}{" "}
					пригласили присоединиться к рабочему пространству в NextTask
				</p>

				{inviteData && (
					<>
						<div className={styles.workspaceInfo}>
							<div className={styles.workspaceName}>
								{inviteData.workspace.name}
							</div>

							{inviteData.workspace.description && (
								<div className={styles.workspaceDescription}>
									{inviteData.workspace.description}
								</div>
							)}

							<div className={styles.workspaceStats}>
								<div className={styles.statItem}>
									<div className={styles.statValue}>
										{inviteData.workspace.usersCount}
									</div>
									<div className={styles.statLabel}>
										Участников
									</div>
								</div>

								<div className={styles.statItem}>
									<div className={styles.statValue}>
										{inviteData.workspace.tasksCount}
									</div>
									<div className={styles.statLabel}>
										Задач
									</div>
								</div>
							</div>
						</div>

						<div className={styles.userInfo}>
							Приглашение от{" "}
							<span className={styles.inviter}>
								{inviteData.inviter.name}
							</span>{" "}
							({inviteData.inviter.email}).
							<br />
							Срок действия приглашения: до{" "}
							{new Date(inviteData.expiresAt).toLocaleString(
								"ru-RU",
							)}
						</div>

						<div className={styles.actionButtons}>
							<Button
								onClick={handleAcceptInvite}
								className={styles.acceptButton}
								disabled={loading}
							>
								Принять приглашение
							</Button>

							<Button
								onClick={handleDeclineInvite}
								className={styles.declineButton}
								disabled={loading}
							>
								Отклонить
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default Invite;
