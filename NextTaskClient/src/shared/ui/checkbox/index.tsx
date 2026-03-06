import { forwardRef, InputHTMLAttributes, ReactNode, useRef } from "react";
import { Check, Minus } from "lucide-react";
import styles from "./index.module.css";

export type CheckboxState = boolean | "indeterminate";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
	label?: ReactNode;
	helperText?: ReactNode;
	state?: CheckboxState;
}

	const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
		({ label, helperText, disabled, className, state, checked, ...rest }, forwardedRef) => {
		const internalRef = useRef<HTMLInputElement>(null);
		const resolvedState: CheckboxState = state ?? (checked ? true : false);
		const isChecked = resolvedState === true;
		const isIndeterminate = resolvedState === "indeterminate";

		const setRefs = (node: HTMLInputElement | null) => {
			internalRef.current = node;
			if (typeof forwardedRef === "function") {
				forwardedRef(node);
			} else if (forwardedRef) {
				forwardedRef.current = node;
			}
		};

		const handleControlClick = (event: React.MouseEvent<HTMLSpanElement>) => {
			if (disabled) return;
			if (event.target instanceof HTMLInputElement) {
				return;
			}
			event.preventDefault();
			internalRef.current?.click();
		};

		const labelClassName = [styles.label, disabled ? styles.labelDisabled : "", className]
			.filter(Boolean)
			.join(" ");
		const checkboxClassName = [
			styles.checkbox,
			isChecked ? styles.checkboxChecked : "",
			isIndeterminate ? styles.checkboxIndeterminate : "",
			disabled ? styles.checkboxDisabled : "",
		]
			.filter(Boolean)
			.join(" ");

		return (
			<label className={labelClassName}>
				<span className={styles.control} onClick={handleControlClick}>
					<span className={checkboxClassName}>
						<input
							type="checkbox"
							ref={setRefs}
							className={styles.native}
							disabled={disabled}
							checked={isChecked}
							aria-checked={isIndeterminate ? "mixed" : isChecked}
							{...rest}
						/>
						{isChecked && <Check className={styles.icon} aria-hidden />}
						{isIndeterminate && !isChecked && (
							<Minus className={styles.icon} aria-hidden />
						)}
					</span>
					{label && <span className={styles.text}>{label}</span>}
				</span>
				{helperText && <span className={styles.helper}>{helperText}</span>}
			</label>
		);
	}
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
