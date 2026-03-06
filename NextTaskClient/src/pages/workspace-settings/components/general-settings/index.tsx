import { FC, useState, useEffect } from "react";
import { Trash2, AlertTriangle, LogOut } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import { Workspace, WorkspaceSettingsForm } from "@shared/types/workspace";
import { workspacesService } from "@entities/workspace";
import styles from "./index.module.css";
import { useAuthStore } from "@entities/user";
import {
	useToastStore,
	createSuccessToast,
	createErrorToast,
} from "@shared/model/toastStore";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "@shared/ui/confirm-modal";

interface GeneralSettingsProps {
	workspace: Workspace;
	onDelete: () => void;
	isOwner: boolean;
}

const GeneralSettings: FC<GeneralSettingsProps> = ({
	workspace,
	onDelete,
	isOwner,
}) => {
	const queryClient = useQueryClient();
	const addToast = useToastStore((state) => state.addToast);
	const navigate = useNavigate();
	const currentUserId = useAuthStore((s) => s.user?.id);
	const [form, setForm] = useState<WorkspaceSettingsForm>({
		name: "",
		description: "",
	});
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmMode, setConfirmMode] = useState<"leave" | "delete" | null>(
		null,
	);
	const [confirmLoading, setConfirmLoading] = useState(false);

	// Мутация для обновления рабочего пространства
	const updateWorkspaceMutation = useMutation({
		mutationFn: async (data: WorkspaceSettingsForm) => {
			try {
				await workspacesService.updateWorkspace(workspace.id, data);
				queryClient.invalidateQueries({
					queryKey: ["workspace", workspace.id],
				});
				addToast(createSuccessToast("Успех", "Настройки сохранены"));
			} catch (err) {
				addToast(
					createErrorToast(
						"Ошибка",
						"Не удалось сохранить настройки",
					),
				);
			}
		},
	});

	// Мутация для удаления рабочего пространства (для владельца)
	const deleteWorkspaceMutation = useMutation({
		mutationFn: () => workspacesService.deleteWorkspace(workspace.id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["workspaces"] });
			onDelete(); // Вызываем callback для навигации
		},
		onError: (error: any) => {
			// Тост об ошибке удаления
			addToast(
				createErrorToast(
					"Не удалось удалить",
					error.message || undefined,
					5000,
				),
			);
		},
	});

	// Мутация выхода из пространства (для обычных пользователей)
	const leaveWorkspaceMutation = useMutation({
		mutationFn: async () => {
			if (!currentUserId)
				throw new Error("Не удалось определить пользователя");
			return workspacesService.removeUser(workspace.id, currentUserId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["workspaces"] });
			navigate("/workspaces");
		},
		onError: (error: any) => {
			// Тост об ошибке выхода
			addToast(
				createErrorToast(
					"Не удалось выйти",
					error.message || undefined,
					5000,
				),
			);
		},
	});

	useEffect(() => {
		if (workspace) {
			setForm({
				name: workspace.name || "",
				description: workspace.description || "",
			});
		}
	}, [workspace]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isOwner) return; // не-владелец не может сохранять
		if (!form.name.trim()) {
			// Тост об ошибке сохранения
			addToast(
				createErrorToast(
					"Не удалось сохранить",
					"Название рабочего пространства обязательно",
					5000,
				),
			);
			return;
		}
		updateWorkspaceMutation.mutate(form);
	};

	const handleDeleteWorkspace = async () => {
		setConfirmMode("delete");
		setConfirmOpen(true);
	};

	const handleLeaveWorkspace = async () => {
		setConfirmMode("leave");
		setConfirmOpen(true);
	};

	const onConfirmModal = async () => {
		if (!confirmMode) return;
		setConfirmLoading(true);
		try {
			if (confirmMode === "leave") {
				await leaveWorkspaceMutation.mutateAsync();
			} else if (confirmMode === "delete") {
				await deleteWorkspaceMutation.mutateAsync();
			}
		} finally {
			setConfirmLoading(false);
			setConfirmOpen(false);
			setConfirmMode(null);
		}
	};

	return (
		<div className={styles.generalSection}>
			<form onSubmit={handleSubmit} className={styles.form}>
				<div className={styles.field}>
					<label htmlFor="workspace-name" className={styles.label}>
						Название рабочего пространства
					</label>
					<Input
						type="text"
						id="workspace-name"
						value={form.name}
						onChange={(e) =>
							setForm((prev) => ({
								...prev,
								name: e.target.value,
							}))
						}
						placeholder="Введите название рабочего пространства"
						className={styles.input}
						required
						disabled={!isOwner}
					/>
				</div>

				<div className={styles.field}>
					<label
						htmlFor="workspace-description"
						className={styles.label}
					>
						Описание (необязательно)
					</label>
					<textarea
						id="workspace-description"
						value={form.description}
						onChange={(e) =>
							setForm((prev) => ({
								...prev,
								description: e.target.value,
							}))
						}
						placeholder="Краткое описание рабочего пространства"
						className={styles.textarea}
						rows={3}
						disabled={!isOwner}
					/>
				</div>

				<div className={styles.actions}>
					<Button
						type="submit"
						disabled={
							!isOwner ||
							updateWorkspaceMutation.isPending ||
							!form.name.trim()
						}
						className={styles.saveBtn}
					>
						{updateWorkspaceMutation.isPending
							? "Сохранение..."
							: "Сохранить изменения"}
					</Button>
				</div>
			</form>

			{isOwner ? (
				<div className={styles.dangerZone}>
					<div className={styles.dangerHeader}>
						<AlertTriangle size={18} /> Опасная зона
					</div>
					<p className={styles.dangerText}>
						Удаление рабочего пространства необратимо. Все задачи и
						данные будут потеряны.
					</p>
					<Button
						type="button"
						onClick={handleDeleteWorkspace}
						className={styles.deleteBtn}
					>
						<Trash2 size={16} /> Удалить рабочее пространство
					</Button>
				</div>
			) : (
				<div className={styles.leaveSection}>
					<div className={styles.leaveHeader}>
						<LogOut size={18} /> Выйти из рабочего пространства
					</div>
					<p className={styles.leaveText}>
						Вы больше не будете иметь доступа к задачам и настройкам
						этого рабочего пространства.
					</p>
					<Button
						type="button"
						onClick={handleLeaveWorkspace}
						className={styles.leaveBtn}
					>
						<LogOut size={16} /> Выйти
					</Button>
				</div>
			)}

			<ConfirmModal
				open={confirmOpen}
				loading={
					confirmLoading ||
					deleteWorkspaceMutation.isPending ||
					leaveWorkspaceMutation.isPending
				}
				variant={confirmMode === "delete" ? "danger" : "default"}
				title={
					confirmMode === "delete"
						? "Удалить рабочее пространство?"
						: "Выйти из рабочего пространства?"
				}
				message={
					confirmMode === "delete"
						? `Это действие необратимо. Все данные будут безвозвратно удалены.`
						: `Вы потеряете доступ к задачам и настройкам этого рабочего пространства.`
				}
				requireMatchText={
					confirmMode === "delete" ? workspace?.name : undefined
				}
				matchLabel={
					confirmMode === "delete"
						? "Для подтверждения введите название рабочего пространства"
						: undefined
				}
				matchPlaceholder={
					confirmMode === "delete" ? workspace?.name : undefined
				}
				confirmLabel={confirmMode === "delete" ? "Удалить" : "Выйти"}
				cancelLabel="Отмена"
				onConfirm={onConfirmModal}
				onCancel={() => {
					setConfirmOpen(false);
					setConfirmMode(null);
				}}
			/>
		</div>
	);
};

export default GeneralSettings;
