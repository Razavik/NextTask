import { FC, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { workspacesService } from "@entities/workspace";
import styles from "./index.module.css";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import Textarea from "@shared/ui/textarea";

const CreateWorkspace: FC = () => {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		try {
			setLoading(true);
			const workspace = await workspacesService.createWorkspace({
				name: name.trim(),
				description: description || undefined,
			});
			navigate(`/workspaces/workspace/${workspace.id}`);
		} catch (e) {
			setError("Не удалось создать рабочее пространство");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div>
					<Link to="/workspaces" className={styles.backButton}>
						&larr; Назад к рабочим пространствам
					</Link>
					<h1 className={styles.title}>
						Создание рабочего пространства
					</h1>
				</div>
			</div>

			{error && <div className={styles.error}>{error}</div>}

			<div className={styles.formCard}>
				<form onSubmit={handleSubmit}>
					<div className={styles.formGroup}>
						<label htmlFor="name" className={styles.formLabel}>
							Название рабочего пространства*
						</label>
						<Input
							id="name"
							type="text"
							value={name}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>,
							) => setName(e.target.value)}
							placeholder="Введите название рабочего пространства"
							required
							autoFocus
						/>
					</div>

					<div className={styles.formGroup}>
						<label
							htmlFor="description"
							className={styles.formLabel}
						>
							Описание
						</label>
						<Textarea
							id="description"
							value={description}
							onChange={(
								e: React.ChangeEvent<HTMLTextAreaElement>,
							) => setDescription(e.target.value)}
							placeholder="Описание рабочего пространства (необязательно)"
							rows={4}
						/>
						<div className={styles.formHelp}>
							Описание поможет участникам понять назначение
							данного рабочего пространства
						</div>
					</div>

					<div className={styles.formActions}>
						<Link to="/workspaces" className={styles.cancelButton}>
							Отмена
						</Link>
						<Button
							type="submit"
							className={styles.submitButton}
							disabled={loading}
						>
							{loading
								? "Создание..."
								: "Создать рабочее пространство"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default CreateWorkspace;
