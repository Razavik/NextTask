import { FC } from "react";
import { Copy, RefreshCw, Trash2, Link2, Clock3, Users } from "lucide-react";
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
		<div className={styles.inviteSection}>
			<div className={styles.inviteHeader}>
				<div>
					<h3 className={styles.sectionTitle}>Ссылки-приглашения</h3>
					<p className={styles.sectionDescription}>
						Создавайте ссылки для новых участников и управляйте
						сроком действия.
					</p>
				</div>
				<Button
					onClick={() => createInviteMutation.mutate()}
					disabled={createInviteMutation.isPending}
					className={styles.addInviteBtn}
				>
					<RefreshCw size={16} /> Добавить ссылку
				</Button>
			</div>

			{isInvitesLoading ? (
				<div className={styles.loaderBox}>
					<Loader />
				</div>
			) : invites.length === 0 ? (
				<div className={styles.empty}>
					<Link2 size={32} />
					<p>
						Ссылок пока нет. Создайте первую, чтобы пригласить
						людей.
					</p>
				</div>
			) : (
				<div className={styles.inviteGrid}>
					{invites.map((inv) => {
						const fullLink = `${window.location.origin}/invite/${inv.invite_token}`;
						return (
							<div
								key={inv.invite_token}
								className={styles.inviteCard}
							>
								<div className={styles.inviteCardHeader}>
									<div className={styles.inviteBadge}>
										Приглашение
									</div>
									<div className={styles.inviteMetaRow}>
										<span className={styles.inviteMetaItem}>
											<Clock3 size={14} />
											{inv.expires_at
												? `до ${new Date(inv.expires_at).toLocaleDateString()}`
												: "Без срока"}
										</span>
										<span className={styles.inviteMetaItem}>
											<Users size={14} /> Использовано{" "}
											{inv.times_used}
										</span>
									</div>
								</div>

								<div className={styles.inviteBody}>
									<Input
										value={fullLink}
										readOnly
										className={styles.inviteLinkInput}
									/>
									<div className={styles.inviteActions}>
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
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default InviteSettings;
