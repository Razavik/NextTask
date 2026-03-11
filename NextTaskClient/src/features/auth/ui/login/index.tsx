import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, type User } from "@entities/user";
import { apiService, ApiRoute } from "@shared/api";
import Input from "@shared/ui/input";
import Button from "@shared/ui/button";
import styles from "../index.module.css";

const Login = () => {
	const navigate = useNavigate();
	const login = useAuthStore((state) => state.login);
	const setUser = useAuthStore((state) => state.setUser);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			const formData = new URLSearchParams();
			formData.append("username", email);
			formData.append("password", password);

			const tokenResponse = await apiService.post<
				{ access_token: string; refresh_token?: string },
				URLSearchParams
			>(ApiRoute.AuthLogin, formData, {
				config: {
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
				},
			});

			login(tokenResponse.access_token);
			if (tokenResponse.refresh_token) {
				localStorage.setItem(
					"refresh_token",
					tokenResponse.refresh_token,
				);
			}

			const userData = await apiService.get<User>(ApiRoute.AuthMe);
			setUser(userData);
			navigate("/workspaces");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Ошибка авторизации");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.authContainer}>
			<h1 className={styles.title}>Вход в NextTask</h1>

			<form className={styles.authForm} onSubmit={handleSubmit}>
				{error && <div className={styles.error}>{error}</div>}

				<Input
					id="email"
					type="email"
					label="Почта"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					error={error || undefined}
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
					{loading ? "Вход..." : "Войти"}
				</Button>
			</form>

			<p className={styles.textCenter}>
				Нет аккаунта?{" "}
				<Link to="/register" className={styles.authLink}>
					Зарегистрироваться
				</Link>
			</p>
		</div>
	);
};

export default Login;
