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
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
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

			<form className={styles.authForm} onSubmit={handleSubmit}>
				{error && <div className={styles.error}>{error}</div>}

				<Input
					id="name"
					type="text"
					label="Имя"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					error={error || undefined}
				/>

				<Input
					id="email"
					type="email"
					label="Почта"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>

				<Input
					id="password"
					type="password"
					label="Пароль"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>

				<Button type="submit" disabled={loading}>
					{loading ? "Создание..." : "Зарегистрироваться"}
				</Button>
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
