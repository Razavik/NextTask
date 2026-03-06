import { FC } from "react";
import styles from "./index.module.css";

interface LoaderProps {
	variant?: 'global' | 'local';
	size?: 'small' | 'medium' | 'large';
	isFullheight?: boolean;
	className?: string;
}

const Loader: FC<LoaderProps> = ({ 
	variant = 'local', 
	size = 'medium',
	isFullheight = false,
	className 
}) => {
	const loaderClass = variant === 'global' 
		? `${styles.loader} ${styles.loaderGlobal}`
		: `${styles.loader} ${styles.loaderLocal}`;
	
	const spinnerClass = `${styles.loader__spinner} ${styles[`spinner--${size}`]}`;

	return (
		<div className={`${loaderClass} ${className || ''} ${isFullheight ? styles.loaderFullheight : ''}`}>
			<div className={spinnerClass}></div>
		</div>
	);
};

export default Loader;
