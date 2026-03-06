import { FC } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getMyInvites, acceptInvite, declineInvite } from "@features/invites";
import type { IncomingInvite } from "@shared/types/invite";
import Button from "@shared/ui/button";
import Loader from "@shared/ui/loader";
import { useToast } from "@shared/lib/hooks/useToast";
import { Mail } from "lucide-react";
import styles from "./index.module.css";

const ProfileInvites: FC = () => {
	const toast = useToast();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: invites = [], isLoading } = useQuery<IncomingInvite[]>({
		queryKey: ["myInvites"],
		queryFn: getMyInvites,
	});

	const acceptMutation = useMutation({
		mutationFn: (token: string) => acceptInvite(token),
		onSuccess: (result) => {
			toast.success(
				"Приглашение принято",
				"Открываю рабочее пространство",
			);
			queryClient.invalidateQueries({ queryKey: ["myInvites"] });
			queryClient.invalidateQueries({ queryKey: ["workspaces"] });
			navigate(`/workspaces/workspace/${result.workspace_id}`);
		},
		onError: (err: any) => {
			const msg =
				err?.response?.data?.detail ||
				(err instanceof Error
					? err.message
					: "Ошибка принятия приглашения");
			toast.error("Не удалось принять", msg);
		},
	});

	const declineMutation = useMutation({
		mutationFn: (inviteId: number) => declineInvite(inviteId),
		onSuccess: () => {
			toast.success(
				"Приглашение отклонено",
				"Мы обновили список приглашений",
			);
			queryClient.invalidateQueries({ queryKey: ["myInvites"] });
		},
		onError: (err: any) => {
			const msg =
				err?.response?.data?.detail ||
				(err instanceof Error
					? err.message
					: "Ошибка отклонения приглашения");
			toast.error("Не удалось отклонить", msg);
		},
	});

	if (isLoading) {
		return (
			<div className={styles.center}>
				<Loader />
			</div>
		);
	}

	if (!invites.length) {
		return (
			<div className={styles.empty}>
				<div className={styles.emptyIcon}>
					<Mail size={36} aria-hidden />
				</div>
				<div className={styles.emptyTitle}>Приглашений нет</div>
				<div className={styles.emptyText}>
					Когда вас пригласят в рабочие пространства, здесь появятся
					приглашения.
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<ul className={styles.list}>
				{invites.map((inv) => (
					<li key={inv.id} className={styles.item}>
						<div className={styles.main}>
							<div className={styles.wsName}>
								{inv.workspace.name}
							</div>
							<div className={styles.meta}>
								От: {inv.inviter.name} ({inv.inviter.email})
							</div>
							{inv.expires_at && (
								<div className={styles.meta}>
									Действительно до{" "}
									{new Date(inv.expires_at).toLocaleString(
										"ru-RU",
									)}
								</div>
							)}
						</div>
						<div className={styles.actions}>
							<Button
								onClick={() => acceptMutation.mutate(inv.token)}
								disabled={
									acceptMutation.isPending ||
									declineMutation.isPending
								}
								className={styles.acceptBtn}
							>
								Принять
							</Button>
							<Button
								onClick={() => declineMutation.mutate(inv.id)}
								disabled={
									acceptMutation.isPending ||
									declineMutation.isPending
								}
								className={styles.declineBtn}
							>
								Отклонить
							</Button>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
};

export default ProfileInvites;
