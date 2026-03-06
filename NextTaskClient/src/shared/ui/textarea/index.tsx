import { FC, TextareaHTMLAttributes, useLayoutEffect, useRef } from "react";
import styles from "./index.module.css";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    // Доп. класс для внутреннего textarea (для стилизации из внешних модулей)
    textareaClassName?: string;
    // Автоматическое увеличение высоты по контенту до maxHeight
    autoGrow?: boolean;
    // Максимальная высота авто-увеличения (в px). Дальше появляется вертикальный скролл
    maxHeight?: number;
}

const Textarea: FC<TextareaProps> = ({
    label,
    error,
    className = "",
    textareaClassName = "",
    autoGrow = false,
    maxHeight = 200,
    ...props
}) => {
    const ref = useRef<HTMLTextAreaElement | null>(null);

    const resize = () => {
        if (!autoGrow || !ref.current) return;
        const el = ref.current;
        // Сначала сбрасываем высоту, чтобы корректно измерить scrollHeight
        el.style.height = "0px";
        const limit = Math.max(0, maxHeight);
        const next = Math.min(el.scrollHeight, limit);
        el.style.height = `${next}px`;
        el.style.overflowY = el.scrollHeight > limit ? "auto" : "hidden";
    };

    useLayoutEffect(() => {
        if (!autoGrow) return;
        // Ждём следующий кадр, чтобы DOM обновил значение/контент
        const id = requestAnimationFrame(resize);
        return () => cancelAnimationFrame(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.value, autoGrow, maxHeight]);

    // Инициализируем высоту при маунте
    useLayoutEffect(() => {
        if (!autoGrow) return;
        const id = requestAnimationFrame(resize);
        return () => cancelAnimationFrame(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={`${styles.textareaWrapper} ${className}`.trim()}>
            {label && (
                <label htmlFor={props.id} className={styles.label}>
                    {label}
                </label>
            )}
            <textarea
                ref={ref}
                className={`${styles.textarea} ${autoGrow ? styles.autoGrow : ""} ${error ? styles.error : ""} ${textareaClassName}`.trim()}
                style={autoGrow ? { maxHeight } : undefined}
                {...props}
                onChange={(e) => {
                    resize();
                    props.onChange?.(e);
                }}
                onInput={(e) => {
                    resize();
                    props.onInput?.(e);
                }}
            />
            {error && <span className={styles.errorMessage}>{error}</span>}
        </div>
    );
};

export default Textarea;
