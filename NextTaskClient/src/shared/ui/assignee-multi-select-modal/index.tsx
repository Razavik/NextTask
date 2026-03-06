import { FC, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import Modal from "@shared/ui/modal";
import Button from "@shared/ui/button";
import AssigneeMultiSelect, {
	AssigneeMultiSelectMember,
} from "@shared/ui/assignee-multi-select";
import styles from "./index.module.css";

interface AssigneeMultiSelectModalProps {
	members: AssigneeMultiSelectMember[];
	selectedIds: number[];
	onChange: (nextIds: number[]) => void;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	modalTitle?: string;
}

const AssigneeMultiSelectModal: FC<AssigneeMultiSelectModalProps> = ({
	members,
	selectedIds,
	onChange,
	label,
	placeholder = "Не назначены",
	disabled = false,
	className,
	modalTitle = "Выбор исполнителей",
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [draftSelection, setDraftSelection] = useState<number[]>(selectedIds);

	useEffect(() => {
		if (!isOpen) {
			setDraftSelection(selectedIds);
		}
	}, [isOpen, selectedIds]);

	const selectedMembers = useMemo(
		() => members.filter((member) => draftSelection.includes(member.id)),
		[members, draftSelection],
	);

	const summaryText = useMemo(() => {
		if (selectedMembers.length === 0) {
			return placeholder;
		}

		const names = selectedMembers.map(
			(member) => member.name || member.email,
		);
		if (names.length <= 2) {
			return names.join(", ");
		}
		return `${names.slice(0, 2).join(", ")} и ещё ${names.length - 2}`;
	}, [selectedMembers, placeholder]);

	const summaryChips = useMemo(() => {
		if (selectedMembers.length === 0)
			return [] as { id: number; label: string }[];
		return selectedMembers.slice(0, 3).map((member) => ({
			id: member.id,
			label: member.name || member.email,
		}));
	}, [selectedMembers]);

	const openModal = () => {
		if (disabled) return;
		setDraftSelection(selectedIds);
		setIsOpen(true);
	};

	const closeModal = () => {
		setDraftSelection(selectedIds);
		setIsOpen(false);
	};

	const handleApply = () => {
		onChange(Array.from(new Set(draftSelection)));
		setIsOpen(false);
	};

	return (
		<div className={`${styles.wrapper} ${className ?? ""}`}>
			{label && <span className={styles.label}>{label}</span>}
			<button
				type="button"
				className={styles.trigger}
				onClick={openModal}
				disabled={disabled}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				aria-label={label ? `${label}: ${summaryText}` : summaryText}
			>
				<span className={styles.triggerIcon} aria-hidden>
					<Users size={18} />
				</span>
				<div className={styles.triggerContent}>
					{summaryChips.length > 0 && (
						<div className={styles.chips}>
							{summaryChips.map((chip) => (
								<span key={chip.id} className={styles.chip}>
									{chip.label}
								</span>
							))}
							{selectedMembers.length > summaryChips.length && (
								<span className={styles.chipMore}>
									+
									{selectedMembers.length -
										summaryChips.length}
								</span>
							)}
						</div>
					)}
				</div>
				<span className={styles.counter}>
					{selectedMembers.length}/{members.length}
				</span>
			</button>

			<Modal
				isOpen={isOpen}
				onClose={closeModal}
				title={modalTitle}
				maxWidth={500}
			>
				<div className={styles.modalContent}>
					<AssigneeMultiSelect
						members={members}
						selectedIds={draftSelection}
						onChange={(ids) =>
							setDraftSelection(Array.from(new Set(ids)))
						}
						placeholder={placeholder}
						label={undefined}
						disabled={disabled}
					/>
					<div className={styles.modalFooter}>
						<div className={styles.footerActions}>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={closeModal}
							>
								Отмена
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={handleApply}
								disabled={
									draftSelection.length === 0 &&
									selectedIds.length === 0
								}
							>
								Готово
							</Button>
						</div>
					</div>
				</div>
			</Modal>
		</div>
	);
};

export default AssigneeMultiSelectModal;
