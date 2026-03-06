import { ButtonHTMLAttributes, FC, ReactNode } from "react";
import styles from "./index.module.css";

type Variant = "primary" | "ghost";
type Size = "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: Variant;
    size?: Size;
}

const Button: FC<Props> = ({ children, className, variant = "primary", size = "md", ...rest }) => {
    const classes = [
        styles.button,
        styles[variant],
        styles[size],
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button {...rest} className={classes}>
            {children}
        </button>
    );
};

export default Button;
