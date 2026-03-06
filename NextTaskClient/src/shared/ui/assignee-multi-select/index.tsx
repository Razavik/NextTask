import { FC, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Button from "@shared/ui/button";
import Checkbox from "@shared/ui/checkbox";
import Input from "@shared/ui/input";
import styles from "./index.module.css";

export interface AssigneeMultiSelectMember {
	id: number;
	name?: string | null;
	email: string;
	position?: string | null;
}

interface AssigneeMultiSelectProps {
	members: AssigneeMultiSelectMember[];
	selectedIds: number[];
	onChange: (nextIds: number[]) => void;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
}

const AssigneeMultiSelect: FC<AssigneeMultiSelectProps> = ({
	members,
	selectedIds,
	onChange,
	label,
	placeholder = "Исполнители не выбраны",
	disabled = false,
	className,
}) => {
	const [search, setSearch] = useState("");

	const filteredMembers = useMemo(() => {
		if (!search.trim()) return members;
		const term = search.trim().toLowerCase();
		return members.filter((member) => {
			const name = member.name?.toLowerCase() ?? "";
			const email = member.email.toLowerCase();
			const position = member.position?.toLowerCase() ?? "";
			return name.includes(term) || email.includes(term) || position.includes(term);
		});
	}, [members, search]);

	const toggleMember = (memberId: number) => {
		if (disabled) return;
		onChange(
			selectedIds.includes(memberId)
				? selectedIds.filter((id) => id !== memberId)
				: [...selectedIds, memberId]
		);
	};

	const handleSelectAll = () => {
		if (disabled) return;
		if (selectedIds.length === members.length) {
			onChange([]);
		} else {
			onChange(members.map((m) => m.id));
		}
	};

	const handleClear = () => {
		if (disabled) return;
		onChange([]);
	};

	return (
		<div className={`${styles.wrapper} ${className ?? ""}`}>
			<div className={styles.header}>
				<div className={styles.titleGroup}>
					{label && (
						<label className={styles.label} htmlFor="assignee-multiselect-search">
							{label}
						</label>
					)}
					<span className={styles.caption}>
						{selectedIds.length > 0 ? "Исполнители выбраны" : placeholder}
					</span>
				</div>
				<div className={styles.summaryActions}>
					<Button
						type="button"
						className={`${styles.actionBtnPrimary}`}
						onClick={handleSelectAll}
						disabled={disabled || members.length === 0}
					>
						{selectedIds.length === members.length && members.length > 0
							? "Снять все"
							: "Выбрать всех"}
					</Button>
					<Button
						type="button"
						className={`${styles.actionBtn} ${styles.actionBtnGhost}`}
						onClick={handleClear}
						disabled={disabled || selectedIds.length === 0}
					>
						Очистить
					</Button>
				</div>
			</div>

			<div className={styles.metaRow}>
				<span className={styles.counter}>
					{selectedIds.length}/{members.length} выбрано
				</span>
			</div>

			<div className={styles.searchContainer}>
				<Search className={styles.searchIcon} />
				<Input
					id="assignee-multiselect-search"
					type="search"
					placeholder="Поиск участника"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					disabled={disabled || members.length === 0}
				/>
			</div>

			<div className={styles.list} role="listbox" aria-multiselectable="true">
				{filteredMembers.length === 0 && (
					<div className={styles.empty}>Совпадений не найдено</div>
				)}
				{filteredMembers.map((member) => {
					const checked = selectedIds.includes(member.id);
					return (
						<div
							key={member.id}
							role="option"
							aria-selected={checked}
							className={`${styles.option} ${checked ? styles.optionSelected : ""}`}
							onClick={() => toggleMember(member.id)}
							onKeyDown={(event) => {
								if (event.key === " " || event.key === "Enter") {
									event.preventDefault();
									toggleMember(member.id);
								}
							}}
							tabIndex={disabled ? -1 : 0}
						>
							<Checkbox
								checked={checked}
								label={member.name ?? member.email}
								onChange={() => toggleMember(member.id)}
								disabled={disabled}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default AssigneeMultiSelect;
