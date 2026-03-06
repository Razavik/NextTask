import { FC } from "react";
import styles from "./index.module.css";

interface SwitchProps {
	label?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	id?: string;
}

const Switch: FC<SwitchProps> = ({
	label,
	checked,
	onChange,
	disabled = false,
	id,
}) => {
	return (
		<label className={styles.switchWrapper} htmlFor={id}>
			{label && <span className={styles.switchLabel}>{label}</span>}
			<span className={styles.toggle}>
				<input
					type="checkbox"
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
					disabled={disabled}
					id={id}
				/>
				<span className={styles.slider}></span>
			</span>
		</label>
	);
};

export default Switch;
