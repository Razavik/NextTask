import { FC, useState, useRef, useEffect, useMemo } from "react";
import styles from "./index.module.css";

interface DropdownOption {
	value: string;
	label: string;
}

interface DropdownProps {
	options: DropdownOption[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	label?: string;
}

const Dropdown: FC<DropdownProps> = ({
	options,
	value,
	onChange,
	placeholder = "Выберите значение",
	disabled = false,
	label,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);
	const selectedOption = options.find((option) => option.value === value);

	// Фильтрация опций по поисковому запросу
	const filteredOptions = useMemo(() => {
		if (!searchQuery.trim()) return options;
		return options.filter((option) =>
			option.label.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}, [options, searchQuery]);

	// Показывать поиск только если опций больше 5
	const showSearch = options.length > 5;

	// Закрытие дропдауна при клике вне его области
	useEffect(() => {
		const handleClickOutside = (event: Event) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		// Используем сразу несколько типов событий, чтобы уверенно закрывать
		document.addEventListener("click", handleClickOutside, true); // capture-phase
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

	// Обработка клавиатуры
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;

		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			setIsOpen(!isOpen);
			// Сбрасываем поиск при открытии
			if (!isOpen) {
				setSearchQuery("");
			}
		}

		if (e.key === "Escape") {
			setIsOpen(false);
		}
	};

	const handleOptionClick = (optionValue: string) => {
		onChange(optionValue);
		setIsOpen(false);
		setSearchQuery("");
	};

	const handleToggle = () => {
		if (!disabled) {
			setIsOpen(!isOpen);
			// Сбрасываем поиск при открытии
			if (!isOpen) {
				setSearchQuery("");
			}
		}
	};

	return (
		<div className={styles.dropdownWrapper}>
			{label && <label className={styles.label}>{label}</label>}
			<div
				className={`${styles.dropdown} ${disabled ? styles.disabled : ""}`}
				ref={dropdownRef}
				tabIndex={disabled ? -1 : 0}
				onKeyDown={handleKeyDown}
				aria-disabled={disabled}
			>
				<div
					className={`${styles.selected} ${isOpen ? styles.open : ""}`}
					onClick={handleToggle}
				>
					<span className={styles.selectedText}>
						{selectedOption ? selectedOption.label : placeholder}
					</span>
					<span
						className={`${styles.arrow} ${
							isOpen ? styles.arrowOpen : ""
						}`}
					/>
				</div>

				{isOpen && (
					<div className={styles.optionsContainer}>
						{showSearch && (
							<div className={styles.searchWrapper}>
								<input
									type="text"
									className={styles.searchInput}
									placeholder="Поиск..."
									value={searchQuery}
									onChange={(e) =>
										setSearchQuery(e.target.value)
									}
									onClick={(e) => e.stopPropagation()}
									autoFocus
								/>
							</div>
						)}
						<ul className={styles.optionsList} role="listbox">
							{filteredOptions.map((option) => (
								<li
									key={option.value}
									className={`${styles.option} ${
										option.value === value
											? styles.selectedOption
											: ""
									}`}
									onClick={() =>
										handleOptionClick(option.value)
									}
									aria-selected={option.value === value}
									role="option"
								>
									{option.label}
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
};

export default Dropdown;
