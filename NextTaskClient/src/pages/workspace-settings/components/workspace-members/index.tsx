import { FC } from "react";
import {
	Users,
	UserPlus,
	Mail,
	Settings,
	SearchX,
	Search,
	MessageCircle,
} from "lucide-react";
import styles from "./index.module.css";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import Loader from "@shared/ui/loader";
import ConfirmModal from "@shared/ui/confirm-modal";
import { useChatStore } from "@entities/chat";
import {
	type WorkspaceRole,
	ALL_WORKSPACE_ROLES,
	WORKSPACE_ROLE_LABELS,
} from "@shared/types/roles";
import { useWorkspaceMembers } from "./useWorkspaceMembers";

interface WorkspaceMembersProps {
	workspaceId: number;
	isOwner?: boolean;
}

const WorkspaceMembers: FC<WorkspaceMembersProps> = ({
	workspaceId,
	isOwner = false,
}) => {
	const { openChat } = useChatStore();
	const {
		currentUser,
		members,
		isLoading,
		filteredMembers,
		inviteEmail,
		setInviteEmail,
		searchQuery,
		setSearchQuery,
		isInviting,
		showInviteForm,
		setShowInviteForm,
		activeDropdown,
		setActiveDropdown,
		dropdownMode,
		setDropdownMode,
		rolePillRefs,
		confirmOpen,
		confirmLoading,
		openDropdownForMember,
		handleInviteMember,
		requestRoleChange,
		requestRemoveMember,
		confirmAction,
		cancelAction,
		formatJoinDate,
		confirmTitle,
		confirmMessage,
		confirmLabel,
		confirmVariant,
	} = useWorkspaceMembers(workspaceId);

	const trimmedQuery = searchQuery.trim();

	return (
		<>
			<div className={styles.header}>
				<div className={styles.titleSection}>
					<Users size={20} />
					<h3 className={styles.title}>
						Участники ({members.length})
					</h3>
				</div>
				<div className={styles.actions}>
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Поиск по нику"
						className={styles.searchInput}
						leadingIcon={<Search size={16} aria-hidden />}
					/>
					{isOwner && (
						<Button
							onClick={() => setShowInviteForm(!showInviteForm)}
							className={styles.inviteBtn}
						>
							<UserPlus size={16} />
							Пригласить
						</Button>
					)}
				</div>
			</div>

			{showInviteForm && (
				<div className={styles.inviteForm}>
					<form
						onSubmit={handleInviteMember}
						className={styles.inviteFormContent}
					>
						<Input
							type="email"
							value={inviteEmail}
							onChange={(e) => setInviteEmail(e.target.value)}
							placeholder="Email для приглашения"
							required
						/>
						<div className={styles.inviteActions}>
							<Button
								type="button"
								onClick={() => {
									setShowInviteForm(false);
									setInviteEmail("");
								}}
								className={styles.cancelBtn}
							>
								Отмена
							</Button>
							<Button
								type="submit"
								disabled={isInviting || !inviteEmail.trim()}
								className={styles.submitBtn}
							>
								{isInviting ? "Отправка..." : "Пригласить"}
							</Button>
						</div>
					</form>
				</div>
			)}

			<div className={styles.membersList}>
				{isLoading ? (
					<Loader />
				) : filteredMembers.length === 0 ? (
					<div className={styles.noResults}>
						<div className={styles.noResultsIcon}>
							<SearchX size={26} aria-hidden />
						</div>
						<div className={styles.noResultsText}>
							<span className={styles.noResultsTitle}>
								{trimmedQuery
									? "Участники не найдены"
									: "Участников пока нет"}
							</span>
							<span className={styles.noResultsHint}>
								{trimmedQuery
									? `Попробуйте изменить запрос «${trimmedQuery}»`
									: "Пригласите коллег с помощью кнопки «Пригласить»."}
							</span>
						</div>
					</div>
				) : (
					filteredMembers.map((member) => (
						<div key={member.id} className={styles.memberItem}>
							<div className={styles.memberInfo}>
								<div className={styles.memberAvatar}>
									{member.avatar ? (
										<img
											src={member.avatar}
											alt={member.name}
											className={styles.avatarImage}
										/>
									) : (
										member.name.charAt(0).toUpperCase()
									)}
								</div>
								<div className={styles.memberDetails}>
									<div className={styles.memberName}>
										{member.name}
										{member.id === currentUser?.id && (
											<span className={styles.youBadge}>
												(вы)
											</span>
										)}
									</div>
									<div className={styles.memberEmail}>
										<Mail size={12} />
										{member.email}
									</div>
									<div className={styles.memberJoined}>
										Присоединился{" "}
										{formatJoinDate(member.joined_at)}
									</div>
								</div>
								{member.id !== currentUser?.id && (
									<button
										className={styles.chatBtn}
										onClick={() =>
											openChat({
												id: `user-${member.id}`,
												type: "personal",
												userId: member.id,
												name: member.name,
												avatar: member.avatar,
											})
										}
										title="Написать сообщение"
									>
										<MessageCircle size={18} />
									</button>
								)}
							</div>

							<div
								className={styles.roleControl}
								onClick={() => {
									if (
										!isOwner ||
										member.id === currentUser?.id
									)
										return;
									if (activeDropdown === member.id) {
										setActiveDropdown(null);
										setDropdownMode("default");
										return;
									}
									openDropdownForMember(member.id);
								}}
								role={
									isOwner && member.id !== currentUser?.id
										? "button"
										: undefined
								}
								aria-haspopup={
									isOwner && member.id !== currentUser?.id
										? "listbox"
										: undefined
								}
								aria-expanded={activeDropdown === member.id}
							>
								<div
									className={`${styles.memberRole} ${
										activeDropdown === member.id
											? styles.open
											: ""
									}`}
									ref={(el) => {
										if (el)
											rolePillRefs.current.set(
												member.id,
												el,
											);
										else
											rolePillRefs.current.delete(
												member.id,
											);
									}}
								>
									<span className={styles.roleText}>
										{
											WORKSPACE_ROLE_LABELS[
												member.role as WorkspaceRole
											]
										}
									</span>
								</div>

								{isOwner && member.id !== currentUser?.id && (
									<button
										className={styles.roleGearBtn}
										type="button"
										aria-label="Настройки роли"
									>
										<Settings size={16} />
									</button>
								)}

								{isOwner && activeDropdown === member.id && (
									<div
										className={styles.roleDropdownMenu}
										onClick={(e) => e.stopPropagation()}
									>
										{dropdownMode === "default" ? (
											<>
												<button
													className={
														styles.roleDropdownItem
													}
													onClick={(e) => {
														e.stopPropagation();
														setDropdownMode(
															"roles",
														);
													}}
												>
													Изменить роль
												</button>
												<button
													className={`${styles.roleDropdownItem} ${styles.dangerItem}`}
													onClick={(e) => {
														e.stopPropagation();
														setActiveDropdown(null);
														setDropdownMode(
															"default",
														);
														requestRemoveMember(
															member.id,
														);
													}}
													title="Исключить участника из пространства"
												>
													Исключить
												</button>
											</>
										) : (
											ALL_WORKSPACE_ROLES.map((role) => (
												<button
													key={role}
													className={
														styles.roleDropdownItem
													}
													disabled={
														role === member.role
													}
													aria-selected={
														role === member.role
													}
													title={
														role === member.role
															? "Текущая роль"
															: undefined
													}
													onClick={(e) => {
														e.stopPropagation();
														if (
															role === member.role
														)
															return;
														requestRoleChange(
															member.id,
															role as WorkspaceRole,
														);
													}}
												>
													{
														WORKSPACE_ROLE_LABELS[
															role
														]
													}
												</button>
											))
										)}
									</div>
								)}
							</div>
						</div>
					))
				)}
			</div>

			<ConfirmModal
				open={confirmOpen}
				loading={confirmLoading}
				title={confirmTitle}
				message={confirmMessage}
				confirmLabel={confirmLabel}
				cancelLabel="Отмена"
				variant={confirmVariant}
				onConfirm={confirmAction}
				onCancel={cancelAction}
			/>
		</>
	);
};

export default WorkspaceMembers;
