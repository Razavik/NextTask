import { FC } from "react";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import {
	createWorkspaceInvite,
	getWorkspaceInvites,
	revokeInvite,
} from "@features/invites";
import type { InviteLinkItem } from "@shared/types/invite";
import styles from "./index.module.css";
import Loader from "@shared/ui/loader";

interface InviteSettingsProps {
	workspaceId: number;
}

const InviteSettings: FC<InviteSettingsProps> = ({ workspaceId }) => {
	const queryClient = useQueryClient();

	// Список приглашений
	const { data: invites = [], isLoading: isInvitesLoading } = useQuery<
		InviteLinkItem[]
	>({
		queryKey: ["workspaceInvites", workspaceId],
		queryFn: () => getWorkspaceInvites(workspaceId),
		enabled: !!workspaceId,
	});

	const createInviteMutation = useMutation({
		mutationFn: () => createWorkspaceInvite(workspaceId),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ["workspaceInvites", workspaceId],
			}),
	});

	const revokeInviteMutation = useMutation({
		mutationFn: (token: string) => revokeInvite(token),
		onSuccess: () =>
			queryClient.invalidateQueries({
				queryKey: ["workspaceInvites", workspaceId],
			}),
	});

	return (
		<>
			<div className={styles.inviteSection}>
				<h3 className={styles.sectionTitle}>Ссылки-приглашения</h3>
				<p className={styles.sectionDescription}>
					Создавайте несколько уникальных ссылок и управляйте их
					сроком действия.
				</p>

				<Button
					onClick={() => createInviteMutation.mutate()}
					disabled={createInviteMutation.isPending}
					className={styles.addInviteBtn}
				>
					<RefreshCw size={16} /> Добавить ссылку
				</Button>

				{isInvitesLoading ? (
					<Loader />
				) : invites.length === 0 ? (
					<p>Ссылок пока нет.</p>
				) : (
					<ul className={styles.inviteList}>
						{invites.map((inv) => {
							const fullLink = `${window.location.origin}/invite/${inv.invite_token}`;
							return (
								<li
									key={inv.invite_token}
									className={styles.inviteItem}
								>
									<Input
										value={fullLink}
										readOnly
										className={styles.inviteLinkInput}
									/>
									<span className={styles.inviteMeta}>
										{inv.expires_at
											? `до ${new Date(inv.expires_at).toLocaleDateString()}`
											: "без срока"}
										· использовано {inv.times_used}
									</span>
									<Button
										onClick={() =>
											navigator.clipboard.writeText(
												fullLink,
											)
										}
										className={styles.copyBtn}
										title="Скопировать"
									>
										<Copy size={14} />
									</Button>
									<Button
										onClick={() =>
											revokeInviteMutation.mutate(
												inv.invite_token,
											)
										}
										className={styles.deleteBtn}
										disabled={
											revokeInviteMutation.isPending
										}
										title="Отозвать"
									>
										<Trash2 size={14} />
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</>
	);
};

export default InviteSettings;
