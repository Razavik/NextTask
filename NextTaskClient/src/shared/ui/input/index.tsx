import { FC, InputHTMLAttributes, ReactNode } from "react";
import styles from "./index.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	leadingIcon?: ReactNode;
}

const Input: FC<InputProps> = ({ label, error, className = "", leadingIcon, ...props }) => {
	const hasIcon = !!leadingIcon;
	return (
		<div className={`${styles.inputWrapper} ${className}`.trim()}>
			{label && (
				<label htmlFor={props.id} className={styles.label}>
					{label}
				</label>
			)}
			<div className={styles.inputControl}>
				{hasIcon && <span className={styles.leadingIcon}>{leadingIcon}</span>}
				<input
					className={`${styles.input} ${hasIcon ? styles.withIcon : ""} ${error ? styles.error : ""}`.trim()}
					{...props}
				/>
			</div>
			{error && <span className={styles.errorMessage}>{error}</span>}
		</div>
	);
};

export default Input;
