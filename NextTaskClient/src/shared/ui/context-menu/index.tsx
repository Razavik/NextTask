import { FC, useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import styles from "./index.module.css";

interface ContextMenuOption {
	value: string;
	label: string;
	icon?: React.ReactNode;
	danger?: boolean;
}

interface ContextMenuProps {
	options: ContextMenuOption[];
	onSelect: (value: string) => void;
	children?: React.ReactNode;
	isOpen?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
}

const ContextMenu: FC<ContextMenuProps> = ({
	options,
	onSelect,
	children,
	isOpen: controlledIsOpen,
	onOpenChange,
}) => {
	const [internalIsOpen, setInternalIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const isControlled = controlledIsOpen !== undefined;
	const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

	const setIsOpen = (value: boolean) => {
		if (!isControlled) {
			setInternalIsOpen(value);
		}
		onOpenChange?.(value);
	};

	// Закрытие меню при клике вне его области
	useEffect(() => {
		const handleClickOutside = (event: Event) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("click", handleClickOutside, true);
		document.addEventListener("touchstart", handleClickOutside, true);
		document.addEventListener("mousedown", handleClickOutside, true);
		return () => {
			document.removeEventListener("click", handleClickOutside, true);
			document.removeEventListener(
				"touchstart",
				handleClickOutside,
				true,
			);
			document.removeEventListener("mousedown", handleClickOutside, true);
		};
	}, []);

	const handleOptionClick = (optionValue: string) => {
		onSelect(optionValue);
		setIsOpen(false);
	};

	const handleToggle = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsOpen(!isOpen);
	};

	return (
		<div
			className={`${styles.contextMenuWrapper} ${isOpen ? styles.active : ""}`}
			ref={menuRef}
		>
			<div className={styles.trigger} onClick={handleToggle}>
				{children || <MoreVertical size={8} />}
			</div>
			{isOpen && (
				<div className={styles.menuContainer}>
					<ul className={styles.menuList}>
						{options.map((option) => (
							<li
								key={option.value}
								className={`${styles.menuItem} ${
									option.danger ? styles.danger : ""
								}`}
								onClick={() => handleOptionClick(option.value)}
							>
								{option.icon && (
									<span className={styles.menuIcon}>
										{option.icon}
									</span>
								)}
								<span className={styles.menuLabel}>
									{option.label}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};

export default ContextMenu;
