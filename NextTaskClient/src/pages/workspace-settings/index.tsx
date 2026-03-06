import { FC, useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Globe, Settings, Users } from "lucide-react";
import styles from "./index.module.css";
import glass from "@shared/styles/glass.module.css";
import Loader from "@shared/ui/loader";
import TabNavigation, { TabItem } from "@shared/ui/tab-navigation";
import GeneralSettings from "@pages/workspace-settings/components/general-settings";
import InviteSettings from "@pages/workspace-settings/components/invite-settings";
import WorkspaceMembers from "@pages/workspace-settings/components/workspace-members";
import { useWorkspaceQuery } from "@entities/workspace";
import WorkspaceHeader from "@widgets/workspace-header/ui";
import { useAuthStore } from "@entities/user";

const WorkspaceSettings: FC = () => {
	const navigate = useNavigate();
	const { workspaceId, tab } = useParams<{
		workspaceId: string;
		tab?: string;
	}>();
	const wsId = Number(workspaceId);
	const userId = useAuthStore((state) => state.user?.id);

	const { data: workspace, isLoading } = useWorkspaceQuery(wsId, userId);

	const isOwner = workspace?.role === "owner";

	const urlToTab = (value?: string | null): string => {
		if (!value) return "general";
		if (value === "general" || value === "members" || value === "invites")
			return value;
		return "general";
	};

	const [activeTab, setActiveTab] = useState<string>(() => urlToTab(tab));

	const tabs: TabItem[] = useMemo(
		() => [
			{
				id: "general",
				label: "Общее",
				icon: <Settings size={16} />,
			},
			{
				id: "members",
				label: "Участники",
				icon: <Users size={16} />,
			},
			{
				id: "invites",
				label: "Приглашения",
				icon: <Globe size={16} />,
				disabled: !isOwner,
			},
		],
		[isOwner],
	);

	useEffect(() => {
		setActiveTab(urlToTab(tab));
	}, [tab]);

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
		return (
			<div className={styles.error}>Пространство не найдено!</div>
		);
	}

	return (
		<>
			<WorkspaceHeader
				title="Настройки пространства"
				onBack={() => navigate(`/workspaces/workspace/${wsId}`)}
				titleIcon={<Settings size={24} />}
			/>

			<TabNavigation
				tabs={tabs}
				activeTab={activeTab}
				onTabChange={(nextId) => {
					setActiveTab(nextId);
					navigate(
						`/workspaces/workspace/${wsId}/settings/${nextId}`,
						{
							replace: false,
						},
					);
				}}
			/>

			<section className={`${styles.section} ${glass.glassSurface}`}>
				{activeTab === "general" && (
					<GeneralSettings
						workspace={workspace!}
						onDelete={handleDeleteWorkspace}
						isOwner={!!isOwner}
					/>
				)}

				{activeTab === "members" && (
					<WorkspaceMembers workspaceId={wsId} isOwner={!!isOwner} />
				)}

				{activeTab === "invites" && isOwner && (
					<InviteSettings workspaceId={wsId} />
				)}
			</section>
		</>
	);
};

export default WorkspaceSettings;
