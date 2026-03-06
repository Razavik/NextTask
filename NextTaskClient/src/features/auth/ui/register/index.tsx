import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "@entities/user";
import Input from "@shared/ui/input";
import Button from "@shared/ui/button";
import styles from "../index.module.css";

const Register = () => {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [step, setStep] = useState(1);

	const handleNextStep = () => {
		setError(null);
		if (step === 1 && !name.trim()) {
			setError("Введите имя");
			return;
		}
		if (step === 2 && !email.trim()) {
			setError("Введите почту");
			return;
		}
		setStep((prev) => prev + 1);
	};

	const handlePrevStep = () => {
		setError(null);
		setStep((prev) => prev - 1);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		if (password !== confirmPassword) {
			setError("Пароли не совпадают");
			setLoading(false);
			return;
		}
		try {
			await authService.register({ name, email, password });
			navigate("/login");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Ошибка регистрации");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.authContainer}>
			<h1 className={styles.title}>Регистрация в NextTask</h1>
			<div className={styles.steps}>
				<div
					className={`${styles.stepItem} ${step >= 1 ? styles.stepItemActive : ""}`}
				>
					<span className={styles.stepDot}>1</span>
					<span>Имя</span>
				</div>
				<div className={styles.stepLine} />
				<div
					className={`${styles.stepItem} ${step >= 2 ? styles.stepItemActive : ""}`}
				>
					<span className={styles.stepDot}>2</span>
					<span>Почта</span>
				</div>
				<div className={styles.stepLine} />
				<div
					className={`${styles.stepItem} ${step >= 3 ? styles.stepItemActive : ""}`}
				>
					<span className={styles.stepDot}>3</span>
					<span>Пароль</span>
				</div>
			</div>

			<form className={styles.authForm} onSubmit={handleSubmit}>
				{error && <div className={styles.error}>{error}</div>}

				{step === 1 && (
					<div className={styles.stepPanel}>
						<p className={styles.stepDescription}>
							Как вас будут видеть в системе
						</p>
						<Input
							id="name"
							type="text"
							label="Имя"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							error={error || undefined}
						/>
						<Button type="button" onClick={handleNextStep}>
							Продолжить
						</Button>
					</div>
				)}

				{step === 2 && (
					<div className={styles.stepPanel}>
						<p className={styles.stepDescription}>
							Укажите email для входа и уведомлений
						</p>
						<Input
							id="email"
							type="email"
							label="Почта"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
						<div className={styles.actionsRow}>
							<Button
								type="button"
								variant="ghost"
								onClick={handlePrevStep}
							>
								Назад
							</Button>
							<Button type="button" onClick={handleNextStep}>
								Продолжить
							</Button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className={styles.stepPanel}>
						<p className={styles.stepDescription}>
							Придумайте пароль для защиты аккаунта
						</p>
						<Input
							id="password"
							type="password"
							label="Пароль"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>

						<Input
							id="confirmPassword"
							type="password"
							label="Подтверждение пароля"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
							error={
								confirmPassword && password !== confirmPassword
									? "Пароли не совпадают"
									: undefined
							}
						/>

						<div className={styles.actionsRow}>
							<Button
								type="button"
								variant="ghost"
								onClick={handlePrevStep}
							>
								Назад
							</Button>
							<Button type="submit" disabled={loading}>
								{loading ? "Создание..." : "Зарегистрироваться"}
							</Button>
						</div>
					</div>
				)}
			</form>

			<p className={styles.textCenter}>
				Уже есть аккаунт?{" "}
				<Link to="/login" className={styles.authLink}>
					Войти
				</Link>
			</p>
		</div>
	);
};

export default Register;
