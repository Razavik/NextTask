import { FC, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Settings, Users, Globe } from "lucide-react";
import styles from "./index.module.css";
import glass from "@shared/styles/glass.module.css";
import Loader from "@shared/ui/loader";
import GeneralSettings from "@pages/workspace-settings/components/general-settings";
import InviteSettings from "@pages/workspace-settings/components/invite-settings";
import WorkspaceMembers from "@pages/workspace-settings/components/workspace-members";
import { useWorkspaceQuery } from "@entities/workspace";
import WorkspaceHeader from "@widgets/workspace-header/ui";
import { useAuthStore } from "@entities/user";

const WorkspaceSettings: FC = () => {
	const navigate = useNavigate();
	const { workspaceId } = useParams<{
		workspaceId: string;
	}>();
	const wsId = Number(workspaceId);
	const userId = useAuthStore((state) => state.user?.id);

	const { data: workspace, isLoading } = useWorkspaceQuery(wsId, userId);

	const isOwner = workspace?.role === "owner";

	const generalRef = useRef<HTMLDivElement | null>(null);
	const membersRef = useRef<HTMLDivElement | null>(null);
	const invitesRef = useRef<HTMLDivElement | null>(null);

	const handleScrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
		ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const handleDeleteWorkspace = async () => {
		console.log("Deleting workspace:", wsId);
		navigate("/workspaces");
	};

	if (isLoading) {
		return (
			<>
				<div className={styles.container}>
					<Loader />
				</div>
			</>
		);
	}

	if (!workspace) {
		return <div className={styles.error}>Пространство не найдено!</div>;
	}

	return (
		<>
			<WorkspaceHeader
				title="Настройки пространства"
				onBack={() => navigate(`/workspaces/workspace/${wsId}`)}
				titleIcon={<Settings size={24} />}
			/>

			<section className={styles.layout}>
				<aside className={`${styles.sidebar} ${glass.glassPanel}`}>
					<div className={styles.sidebarHeader}>
						<h2 className={styles.sidebarTitle}>
							Что можно настроить
						</h2>
						<p className={styles.sidebarText}>
							Все основные параметры пространства собраны на одной
							странице.
						</p>
					</div>
					<div className={styles.sidebarList}>
						<div
							className={`${styles.sidebarItem} ${glass.glassItem}`}
							onClick={() => handleScrollTo(generalRef)}
						>
							<Settings size={16} />
							<span>Общие параметры пространства</span>
						</div>
						<div
							className={`${styles.sidebarItem} ${glass.glassItem}`}
							onClick={() => handleScrollTo(membersRef)}
						>
							<Users size={16} />
							<span>Управление участниками</span>
						</div>
						{isOwner && (
							<div
								className={`${styles.sidebarItem} ${glass.glassItem}`}
								onClick={() => handleScrollTo(invitesRef)}
							>
								<Globe size={16} />
								<span>Приглашения и доступ</span>
							</div>
						)}
					</div>
				</aside>

				<div className={styles.contentColumn}>
					<div className={styles.summaryRow}>
						<div
							className={`${styles.summaryCard} ${glass.glassCard}`}
						>
							<span className={styles.summaryLabel}>Роль</span>
							<strong className={styles.summaryValue}>
								{isOwner ? "Владелец" : "Участник"}
							</strong>
						</div>
						<div
							className={`${styles.summaryCard} ${glass.glassCard}`}
						>
							<span className={styles.summaryLabel}>
								Статус доступа
							</span>
							<strong className={styles.summaryValue}>
								{isOwner
									? "Полный доступ"
									: "Ограниченный доступ"}
							</strong>
						</div>
					</div>

					<section
						className={`${styles.section}`}
					>
						<div
							className={`${styles.block} ${glass.glassSoft}`}
							ref={generalRef}
						>
							<div className={styles.blockHeader}>
								<h3 className={styles.blockTitle}>
									Общие настройки
								</h3>
								<p className={styles.blockText}>
									Изменяйте название, описание и управляйте
									жизненным циклом пространства.
								</p>
							</div>
							<GeneralSettings
								workspace={workspace!}
								onDelete={handleDeleteWorkspace}
								isOwner={!!isOwner}
							/>
						</div>

						<div
							className={`${styles.block} ${glass.glassSoft}`}
							ref={membersRef}
						>
							<div className={styles.blockHeader}>
								<h3 className={styles.blockTitle}>Участники</h3>
								<p className={styles.blockText}>
									Просматривайте состав команды и управляйте
									доступом участников.
								</p>
							</div>
							<WorkspaceMembers
								workspaceId={wsId}
								isOwner={!!isOwner}
							/>
						</div>

						{isOwner && (
							<div
								className={`${styles.block} ${glass.glassSoft}`}
								ref={invitesRef}
							>
								<div className={styles.blockHeader}>
									<h3 className={styles.blockTitle}>
										Приглашения
									</h3>
									<p className={styles.blockText}>
										Отправляйте приглашения новым участникам
										и контролируйте вход в пространство.
									</p>
								</div>
								<InviteSettings workspaceId={wsId} />
							</div>
						)}
					</section>
				</div>
			</section>
		</>
	);
};

export default WorkspaceSettings;
